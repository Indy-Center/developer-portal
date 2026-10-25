---
title: Deploying to the VPS servers
description: How an app gets onto one of the VPS servers behind its Traefik — the repository shape, routing labels, DNS and certificates, secrets, backups — and how each server is set up.
sidebar:
  order: 6
---

The VPS servers run the apps that can't be Workers: long-running servers and self-hosted software shipped as containers. Each server runs its own Traefik, deployed from [`docker-infrastructure`](https://github.com/Indy-Center/docker-infrastructure), which terminates TLS for `*.flyindycenter.com` and routes to the apps on that server only. Each app lives in its own repository, runs on one server, and deploys itself there with GitHub Actions; DNS decides which server answers each hostname. This page is for someone adding an app; [CI shape](/patterns/ci-shape/#deploy-to-the-vps) has the workflow side.

There are two servers today, each known by the prefix of its deploy settings:

| Server         | What it is                                    | For                                               |
| -------------- | --------------------------------------------- | ------------------------------------------------- |
| **ALEXANDRIA** | A Hostinger VPS, `alexandria.flyzid.org`      | Every new app, and every existing app as it moves |
| **VANDERBILT** | The DigitalOcean droplet the setup started on | The apps not yet moved. It closes once they have  |

**Status.** Traefik and the pipeline are live and the wiki is routed through them. The first app deployed with the [`examples/app/`](https://github.com/Indy-Center/docker-infrastructure/tree/main/examples/app) workflows is [`vnas-discord-bot`](https://github.com/Indy-Center/vnas-discord-bot), on 2026-09-27; what it turned up is folded in below.

## How the box is set up

| Piece           | Where                                                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Traefik         | `/home/deploy/traefik/`, deployed from `docker-infrastructure`'s `traefik/` folder                                                                                   |
| Apps            | `/home/deploy/apps/<repo name>/`, one directory per app                                                                                                              |
| Backup runner   | `/home/deploy/backup-runner/`, deployed from `docker-infrastructure`; see [Backups](/operations/backups/)                                                            |
| Backup staging  | `/home/deploy/backups/<app>/`, emptied after each backup                                                                                                             |
| Shared network  | `traefik-shared`; every compose project uses it as `external: true`                                                                                                  |
| Certificate     | One Let's Encrypt wildcard, `flyindycenter.com` + `*.flyindycenter.com`, renewed by Traefik                                                                          |
| DNS             | `*.flyindycenter.com` points at the droplet, DNS-only. Each app on ALEXANDRIA has its own record; see [Hostname, DNS and certificate](#hostname-dns-and-certificate) |
| Docker          | Docker's own apt packages, held, on a server set up from `docker-infrastructure`'s `host/`. The Canonical snap, held, on the DigitalOcean droplet                    |
| Off-box backups | Cloudflare R2 bucket `indy-center-backups`, encrypted, in folders by how long each copy is kept, with a bucket lock; see [Backups](/operations/backups/)             |

Deploys run as the `deploy` user, which is in the `docker` group. Traefik only routes containers labelled `traefik.enable=true`, redirects HTTP to HTTPS, and serves the wildcard certificate to every router with `tls=true`; apps never request their own.

> **Why everything is under `/home/deploy`.** Docker on the droplet is the Canonical snap. Snap confinement stops both the `docker` CLI and the daemon from reading most paths outside `/home`, so a compose file in `/opt` fails with "no such file or directory" even though the file is there. Considered, not chosen: replacing the snap with Docker's own packages on the droplet. That means copying every container's data to a new location with the wiki down, and moving the paths fixed the problem without it. A new server gets Docker's apt packages instead, and keeps the same `/home/deploy` layout so apps don't care which server they're on. Either way Docker's updates are held, because each one restarts every container.

## Adding an app

### The repository

Copy [`examples/app/`](https://github.com/Indy-Center/docker-infrastructure/tree/main/examples/app) into the new repository's root:

- `deploy/docker-compose.yml` — what lands in `~/apps/<repo name>/`. Anything else the app mounts, such as a config file, goes in `deploy/` too.
- `.github/workflows/ci.yml` — the project's own checks, then the compose file is validated and its images pulled.
- `.github/workflows/build-and-deploy.yml` — runs CI, rsyncs `deploy/` to the box, runs `docker compose up -d`, and fails if anything is restarting 15 seconds later. It reads the app's name from the repository, so it needs no edits.

The repository's name becomes the directory on the box and the Compose project name, which prefixes the app's volumes. Renaming the repository later starts the app with new, empty volumes; the old ones stay behind until someone moves the data.

### Apps that build their own image

The example runs someone else's published image. An app built from its own repository builds the image in CI, pushes it to GitHub's container registry (GHCR), and the box pulls it — the VPS never builds. From `vnas-discord-bot`'s `build-and-deploy.yml`, before the SSH setup:

```yaml
permissions:
  contents: read
  packages: write # push the image to ghcr.io

# ...in the build-and-deploy job:
env:
  APP: ${{ github.event.repository.name }}
  IMAGE: ghcr.io/indy-center/vnas-discord-bot
steps:
  - uses: actions/checkout@v4
  - name: Build and push the image
    env:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    run: |
      echo "$GITHUB_TOKEN" | docker login ghcr.io -u "${{ github.actor }}" --password-stdin
      # The source label links the package to this repository, so it inherits the repo's access.
      docker build \
        --label org.opencontainers.image.source="https://github.com/${{ github.repository }}" \
        -t "$IMAGE:latest" -t "$IMAGE:${{ github.sha }}" .
      docker push --all-tags "$IMAGE"
```

`deploy/docker-compose.yml` then uses `image: ghcr.io/indy-center/<repo>:latest`.

**Make the package public after the first push.** GHCR creates every new package as private, even for a public repository, and the box pulls without logging in, so the first deploy fails with `unauthorized`. Open **github.com/orgs/Indy-Center/packages → the package → Package settings → Change visibility → Public**, then re-run the deploy. GitHub's API can't change visibility; it's a one-time click. Nothing secret goes in an image — runtime values come from the `ENV_*` secrets at deploy time — so a public image exposes only a build of code that's already public.

Considered, not chosen: keeping packages private and logging the box in. A long-lived token on the box belongs to one person's account and reads every package they can. Logging in per deploy with the workflow's own `GITHUB_TOKEN`, into a per-app Docker config directory, keeps nothing on the box, but the token expires with the run, so a manual `docker compose pull` on the box fails. That per-deploy login is the route for an app whose repository is private.

### Routing

The web-facing service joins `traefik-shared` and carries the router labels. Everything else — databases, caches — stays on the app's own network. An app with a database:

```yaml
services:
  app:
    image: ghcr.io/indy-center/myapp:latest
    restart: unless-stopped
    env_file:
      - path: .env
        required: false # written by the deploy from ENV_* secrets
    networks:
      - traefik-shared
      - internal
    labels:
      - traefik.enable=true
      # Router names are global across every app on the box; prefix them with the app's name.
      - traefik.http.routers.myapp.rule=Host(`myapp.flyindycenter.com`)
      - traefik.http.routers.myapp.entrypoints=websecure
      - traefik.http.routers.myapp.tls=true
      # Required when the image exposes more than one port.
      - traefik.http.services.myapp.loadbalancer.server.port=3000

  db:
    image: postgres:17-alpine
    env_file:
      - path: .env
        required: false
    volumes:
      - db-data:/var/lib/postgresql/data # named volume, never a folder under deploy/
    networks:
      - internal

networks:
  traefik-shared:
    external: true
  internal:

volumes:
  db-data:
```

Don't publish ports on the host; Traefik reaches the container over `traefik-shared`. Keep data in named volumes: the deploy rsyncs with `--delete`, so a bind mount under `deploy/` is wiped by the next deploy.

An app with no web surface — a bot that only makes outbound calls, like `vnas-discord-bot` — skips all of this: no labels, no `traefik-shared`, no published ports.

### Hostname, DNS and certificate

Every server's Traefik serves the same wildcard certificate, so any `<name>.flyindycenter.com` is covered on every server with no certificate request. DNS is what decides which server answers.

**An app on ALEXANDRIA needs its own DNS record.** The `*.flyindycenter.com` wildcard record points at the droplet, so a hostname without a record of its own reaches the droplet's Traefik, which has no router for it and answers `404`. Before the first deploy, add the record by hand in Cloudflare, **DNS → Records → Add record**:

| Type  | Name     | Target                  | Proxy status |
| ----- | -------- | ----------------------- | ------------ |
| CNAME | `<name>` | `alexandria.flyzid.org` | DNS only     |

A CNAME to the server's own name rather than an A record to its IP, so an IP change is one record to fix, not one per app. DNS-only, because Traefik serves the certificate itself. `social` and `moodle` were made this way. An app whose first sign-up becomes its owner, like Postiz, gets its record only after that sign-up, which is done through a hosts-file line pointing at the server, so nobody else reaches it first. Don't change or delete a record another app already uses; moving an app between servers switches its record on purpose, as one step of the move.

The wildcard stays on the droplet while apps move, and is deleted with the droplet's records once they all have. A hostname with no record then fails to resolve, instead of quietly reaching whichever server the wildcard happens to point at.

An explicit DNS record wins over the wildcard. If one exists for the hostname — left over from an old deployment, or proxied through Cloudflare — it decides where traffic goes. Check **DNS → Records** in Cloudflare before assuming the wildcard applies.

### Serving under a path

An app can live under a path on a hostname instead of on its own subdomain — Moodle at `training.flyindycenter.com/moodle` is the first planned case. Add a `PathPrefix` to the router rule; nothing in Traefik's own config changes:

```yaml
labels:
  - traefik.enable=true
  - traefik.http.routers.moodle.rule=Host(`training.flyindycenter.com`) && PathPrefix(`/moodle`)
  - traefik.http.routers.moodle.entrypoints=websecure
  - traefik.http.routers.moodle.tls=true
```

Only do this for apps that support a base URL, and have the app serve the path itself. Moodle does: set `$CFG->wwwroot` to the full URL, including `/moodle`, before the first install, because it writes absolute links into its database and moving it later means rewriting them. Wiki.js 2 doesn't support a base path, so it keeps a subdomain.

Considered, not chosen: Traefik's `StripPrefix` middleware, which hides the path from the app. Most apps still write absolute links and redirects to `/`, so pages break in ways that are hard to trace. Use it only for an app that provably emits relative URLs.

When a path-routed app shares a hostname with another app on the box, the longer rule wins: `Host && PathPrefix` beats a plain `Host`, so the two can coexist without priorities.

### Sharing a hostname with a Worker

If the hostname belongs to a Worker, requests never reach the VPS. How the Worker is attached decides whether a path can be carved out:

- **Custom Domain.** The Worker owns every path on the hostname and there's no origin behind it. A path can't be sent anywhere else; the Worker has to move to a route first.
- **Route** (`pattern: "<host>/*"`). Add a second, more specific route for the path, such as `training.flyindycenter.com/moodle*`, with no Worker assigned, and a **proxied** DNS record for the hostname pointing at the VPS. Cloudflare sends that path to the origin and everything else to the Worker.

The no-Worker route and the DNS record live in the Cloudflare dashboard, not in either repository; note them in both apps' READMEs. Switching a Worker from a Custom Domain to a route removes the DNS record the Custom Domain created, so put the proxied record and the routes in place in the same change, or the Worker's site goes down in between.

Considered, not chosen: having the Worker pass the path through itself (`return fetch(request)`). It keeps the configuration in git, but every request to the VPS app then counts against the Worker's request and CPU limits.

### Secrets

Two kinds, kept apart:

- **Deploy credentials.** Four organization settings per server, named with its prefix: variables `<SERVER>_HOST` and `<SERVER>_DEPLOY_USER`, secrets `<SERVER>_DEPLOY_SSH_KEY` and `<SERVER>_KNOWN_HOSTS` (`ALEXANDRIA_HOST` and so on). The workflow names its server once, at the top, and reads the four by that prefix. Its **Set up SSH** step checks all four are there before anything reaches a server, and fails naming each one it can't see. All of them are limited to selected repositories, so an org admin gives the new repository the four of its server before its first deploy: **Org Settings → Secrets and variables → Actions → (setting) → Repository access**.
- **Runtime values.** Database passwords, API tokens, and any setting the app reads from its environment. Each one is its own repository secret named `ENV_<NAME>`, or a repository variable with the same prefix when it isn't secret. Anyone who administers the app's repository sets them under **Settings → Secrets and variables → Actions**; nobody needs SSH access to the box.

The server, from the top of `build-and-deploy.yml`:

```yaml
env:
  # The server this app runs on, by the prefix of its four organization settings.
  SERVER: ALEXANDRIA
```

Moving the app to another server starts with this line, and the four settings of the new server.

The **Write .env** step in `build-and-deploy.yml` lists each setting by name, mapped from wherever it's stored:

```yaml
- name: Write .env
  env:
    # One line per setting in deploy/.env.example. secrets.* for real secrets, vars.* for the rest.
    ENV_DISCORD_TOKEN: ${{ secrets.ENV_DISCORD_TOKEN }}
    ENV_CHANNEL_ID: ${{ vars.ENV_CHANNEL_ID }}
```

On every deploy it strips the prefix from each setting that's set and writes `~/apps/<repo name>/.env` on the box. `ENV_DISCORD_TOKEN` becomes:

```sh
DISCORD_TOKEN='the value'   # single-quoted, so Compose reads $ and # literally
```

`deploy/.env.example` in the repository lists the names the app expects, without values. Adding a setting means three things: a line in `.env.example`, a repository secret or variable, and a line in the step. The compose file reads the result with `env_file: .env`.

- **Changing a value.** Update the one secret or variable and re-run the deploy. Compose sees the environment changed and recreates the container.
- **Unset settings.** A setting listed in the step but not set in GitHub arrives empty and is left out of `.env`, so the app's own default applies.
- **The file on the box.** The deploy owns it and rewrites it every time. An edit made on the box lasts until the next deploy.
- **Quotes and newlines.** A value can't contain a single quote or a newline. The step fails with the secret's name before anything reaches the box.
- **Where values are kept.** GitHub never shows a secret again after it's saved; keep the source copy in 1Password.
- **Secret or variable.** Only real secrets go in secrets. GitHub replaces every secret's value with `***` anywhere it appears in a log, so a secret like `false` or `5` masks those strings in every step's output and makes failures hard to read. Flags, numbers and log levels are `ENV_*` variables.

Considered, not chosen: a hand-made `.env` on the box that the deploy never touches. It keeps runtime secrets out of GitHub, but every change needs someone with SSH access, and a rebuilt box comes back without them. A repository with a server's deploy credentials can already run anything on that server as `deploy`, so keeping its runtime secrets out of GitHub protects little. One `ENV_FILE` secret holding the whole file was also considered; it means re-pasting every value to change one.

Considered, not chosen: collecting every `ENV_*` secret automatically with `toJSON(secrets)`, so a new setting needs no workflow change. That hands every secret the repository can see — the deploy key included — to a step that sends data to another host, and GitHub's malicious-workflow detection held the first app's deploy for exactly that. Listing settings by name costs one line per setting and means the step sees only what the app needs.

The secrets each server needs for itself arrive the same way, from `docker-infrastructure`'s own repository secrets, written by its deploy to every server on every run. Traefik's Cloudflare DNS token is the repository secret `CF_DNS_API_TOKEN`, one token for every server, written to `/home/deploy/traefik/.env` (mode 600) before Traefik starts; Traefik reads it at every renewal. The backup runner's R2 key, encryption key and webhooks go to `~/backup-runner/secrets/` the same way ([Backups](/operations/backups/#secrets)). The deploy owns those files, so don't edit them on a server, and a new or rebuilt server gets them from its first deploy with no step by hand.

To rotate Traefik's token: roll it in Cloudflare, update the 1Password item "Traefik — Cloudflare DNS token" and the secret, then run **Build and Deploy** in `docker-infrastructure` by hand. Anyone who can change that repository's workflows can read the token, but it can only edit DNS on `flyindycenter.com`, and Cloudflare accepts it only from the servers' IPs, so a copy is no use anywhere else.

### First deploy

Run **Actions → Build and Deploy → Run workflow**, or merge to `main`. Then check the app from outside and from the box:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' https://<name>.flyindycenter.com/
# on the app's server
cd /home/deploy/apps/<repo name> && docker compose ps && docker compose logs --tail 50
```

A `404` from Traefik means it didn't pick up the router. Check the labels and that the service is on `traefik-shared`; the dashboard, below, shows every router Traefik knows about and why any of them are broken.

### Backups

An app is backed up by shipping `deploy/backup.sh` and `deploy/restore.sh`, or an empty `deploy/no-backup` if it keeps nothing; an app with neither raises an alert every night. [Backups](/operations/backups/#what-an-app-ships) has the contract and the schedule, and [Recover one app](/operations/recover-one-app/) the way back.

## Operating the servers

- **Traefik changes.** A pull request to `docker-infrastructure`. Merging deploys it to every server in its list. Changes under `traefik/dynamic/` apply without a restart; changes to `traefik.yml` or its compose file recreate the container, which interrupts every app for a couple of seconds.
- **Dashboard.** One per server, read-only, on that server's loopback address only. Open it through an SSH tunnel with an admin account; the `deploy` key can't forward ports. `ssh -L 8080:localhost:8080 <admin>@<server>`, then `http://localhost:8080/dashboard/`.
- **Logs.** `docker logs -f traefik` for routing and certificates; `docker compose logs -f` in an app's directory for the app.
- **Docker updates.** Held. Upgrade by hand in a quiet period: `snap refresh docker` on the droplet, which restarts every container; on a server set up from `host/`, as [its README](https://github.com/Indy-Center/docker-infrastructure/blob/main/host/README.md) says.
- **Certificate renewal.** Automatic, on each server. Traefik renews 30 days before expiry using the Cloudflare token the deploy writes to `/home/deploy/traefik/.env`. The token is locked to the servers' IPs, so if a server ever changes IP, its renewals fail — loudly in Traefik's logs, with a month to fix it: add the new IP to the token's allow-list in Cloudflare.
- **Adding a server.** Ordering it, its base setup, its four settings and its place in `docker-infrastructure`'s server list are the Rebuild the VPS runbook's job, in Operations, rather than this page's.

## Things that bit us

Each of these happened during the setup.

- **Cloudflare SSL mode Flexible.** Flexible sends traffic to the origin over plain HTTP. Traefik redirects HTTP to HTTPS, so every request loops (`ERR_TOO_MANY_REDIRECTS`). The zone is on Full; move it to Full (strict) rather than back.
- **Proxied to DNS-only too early.** A proxied record hides the origin's certificate from browsers. Switching a hostname to DNS-only, or deleting its record so the wildcard takes over, exposes whatever certificate the origin serves. Only do it once the VPS serves a valid one.
- **Cloudflare error 1014.** A proxied CNAME pointing into another Cloudflare account. It isn't an SSL problem and the SSL mode can't fix it; the record needs re-pointing or deleting.
- **Account-owned Cloudflare tokens.** `/user/tokens/verify` rejects them as invalid. Verify at `/accounts/<account id>/tokens/verify` instead; the token itself works.
- **Duplicate router names.** Two apps defining `routers.web` overwrite each other silently. Prefix every router and service name with the app's name.
- **Private GHCR package.** The first app deploy failed at `docker compose pull` with `unauthorized`: the image was pushed fine, but GHCR had made the new package private. Making it public fixed it; see [Apps that build their own image](#apps-that-build-their-own-image).
- **Short values as secrets.** The same first deploy's logs had `sleep ***` and hashes full of `***`, because a few settings like `false` were stored as secrets. They belong in variables.
- **"This workflow file may be malicious."** A later deploy was held for approval because the Write .env step passed `toJSON(secrets)` to a step that uses SSH. The step now lists settings by name. If a workflow is held anyway, check that secrets leave the runner only through `ssh vps` before clicking **Approve and run**.

## Out of scope

Workers — see [CI shape](/patterns/ci-shape/). The k3s cluster, which is being phased out and takes no new apps. TeamSpeak, which runs on the VPS outside Docker and hasn't moved onto this setup.
