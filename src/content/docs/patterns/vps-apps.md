---
title: Deploying to the VPS
description: How an app gets onto the Vanderbilt VPS behind the shared Traefik — the repository shape, routing labels, DNS and certificates, secrets, backups — and how the box itself is set up.
sidebar:
  order: 6
---

The Vanderbilt VPS runs the apps that can't be Workers: long-running servers and self-hosted software shipped as containers. One Traefik instance, deployed from [`docker-infrastructure`](https://github.com/Indy-Center/docker-infrastructure), terminates TLS for `*.flyindycenter.com` and routes to every app on the box. Each app lives in its own repository and deploys itself with GitHub Actions. This page is for someone adding an app; [CI shape](/patterns/ci-shape/#deploy-to-the-vps) has the workflow side.

**Status.** Traefik and the pipeline are live and the wiki is routed through them. The app workflows in [`examples/app/`](https://github.com/Indy-Center/docker-infrastructure/tree/main/examples/app) are the documented pattern but haven't been through a real app yet; expect this page to change after the first one.

## How the box is set up

| Piece           | Where                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------- |
| Traefik         | `/home/deploy/traefik/`, deployed from `docker-infrastructure`'s `traefik/` folder          |
| Apps            | `/home/deploy/apps/<repo name>/`, one directory per app                                     |
| Backup staging  | `/home/deploy/backups/<app>/`                                                               |
| Shared network  | `traefik-shared`, created once by hand; every compose project uses it as `external: true`   |
| Certificate     | One Let's Encrypt wildcard, `flyindycenter.com` + `*.flyindycenter.com`, renewed by Traefik |
| DNS             | `*.flyindycenter.com` points at the VPS, DNS-only                                           |
| Off-box backups | Cloudflare R2 bucket `vanderbelt-backups`, one prefix per app, 60-day lifecycle             |

Deploys run as the `deploy` user, which is in the `docker` group. Traefik only routes containers labelled `traefik.enable=true`, redirects HTTP to HTTPS, and serves the wildcard certificate to every router with `tls=true`; apps never request their own.

> **Why everything is under `/home/deploy`.** Docker on this box is the Canonical snap. Snap confinement stops both the `docker` CLI and the daemon from reading most paths outside `/home`, so a compose file in `/opt` fails with "no such file or directory" even though the file is there. Considered, not chosen: replacing the snap with Docker's own packages. That means copying every container's data to a new location with the wiki down, and moving the paths fixed the problem without it. The snap's automatic updates are held (`snap refresh --hold docker`), because each one restarts every container.

## Adding an app

### The repository

Copy [`examples/app/`](https://github.com/Indy-Center/docker-infrastructure/tree/main/examples/app) into the new repository's root:

- `deploy/docker-compose.yml` — what lands in `~/apps/<repo name>/`. Anything else the app mounts, such as a config file, goes in `deploy/` too.
- `.github/workflows/ci.yml` — the project's own checks, then the compose file is validated and its images pulled.
- `.github/workflows/build-and-deploy.yml` — runs CI, rsyncs `deploy/` to the box, runs `docker compose up -d`, and fails if anything is restarting 15 seconds later. It reads the app's name from the repository, so it needs no edits.

The repository's name becomes the directory on the box and the Compose project name, which prefixes the app's volumes. Renaming the repository later starts the app with new, empty volumes; the old ones stay behind until someone moves the data.

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

### Hostname, DNS and certificate

Any `<name>.flyindycenter.com` already works. The wildcard DNS record sends it to the VPS and the wildcard certificate covers it, so a new app needs no DNS change and no certificate request.

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

- **Deploy credentials.** The four `VANDERBILT_*` organization secrets. They're limited to selected repositories, so an org admin adds the new repository to each of them before its first deploy: **Org Settings → Secrets and variables → Actions → (secret) → Repository access**.
- **Runtime values.** Database passwords, API tokens, and any setting the app reads from its environment. Each one is its own repository secret named `ENV_<NAME>`, or a repository variable with the same prefix when it isn't secret. Anyone who administers the app's repository sets them under **Settings → Secrets and variables → Actions**; nobody needs SSH access to the box.

On every deploy, the **Write .env** step collects every `ENV_*` secret and variable, strips the prefix, and writes `~/apps/<repo name>/.env` on the box. `ENV_DISCORD_TOKEN` becomes:

```sh
DISCORD_TOKEN='the value'   # single-quoted, so Compose reads $ and # literally
```

`deploy/.env.example` in the repository lists the names the app expects, without values, so whoever sets the secrets knows what's needed. The compose file reads the result with `env_file: .env`.

- **Changing a value.** Update the one secret and re-run the deploy. Compose sees the environment changed and recreates the container.
- **The file on the box.** The deploy owns it and rewrites it every time. An edit made on the box lasts until the next deploy.
- **Quotes and newlines.** A value can't contain a single quote or a newline. The step fails with the secret's name before anything reaches the box.
- **Where values are kept.** GitHub never shows a secret again after it's saved; keep the source copy in 1Password.

Considered, not chosen: a hand-made `.env` on the box that the deploy never touches. It keeps runtime secrets out of GitHub, but every change needs someone with SSH access, and a rebuilt box comes back without them. A repository with the `VANDERBILT_*` secrets can already run anything on the box as `deploy`, so keeping its runtime secrets out of GitHub protects little. One `ENV_FILE` secret holding the whole file was also considered; it means re-pasting every value to change one.

Traefik's Cloudflare token and rclone's R2 credentials are the exception: they stay in files on the box, because Traefik and rclone need them between deploys, not only during one.

### First deploy

Run **Actions → Build and Deploy → Run workflow**, or merge to `main`. Then check the app from outside and from the box:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' https://<name>.flyindycenter.com/
# on the VPS
cd /home/deploy/apps/<repo name> && docker compose ps && docker compose logs --tail 50
```

A `404` from Traefik means it didn't pick up the router. Check the labels and that the service is on `traefik-shared`; the dashboard, below, shows every router Traefik knows about and why any of them are broken.

### Backups

Each app backs itself up. Dumps are staged in `~/backups/<app>/` and pushed to `r2:vanderbelt-backups/<app>/` with rclone, whose R2 credentials live in the `deploy` user's rclone config on the box. The bucket's lifecycle rule deletes objects after 60 days.

The per-app backup workflow — a scheduled job that dumps the app's database over SSH — is being defined as the wiki moves onto this setup. Until then, a manual backup looks like this:

```sh
F=/home/deploy/backups/<app>/<app>-$(date -u +%Y%m%dT%H%MZ).tar.gz
sudo -u deploy mkdir -p /home/deploy/backups/<app>
tar czf "$F" -C <path to the data> . && chown deploy "$F"
sudo -u deploy rclone copy "$F" r2:vanderbelt-backups/<app>/
```

## Operating the box

- **Traefik changes.** A pull request to `docker-infrastructure`. Merging deploys it. Changes under `traefik/dynamic/` apply without a restart; changes to `traefik.yml` or its compose file recreate the container, which interrupts every app for a couple of seconds.
- **Dashboard.** Read-only, on the VPS's loopback address only. Open it through an SSH tunnel with an admin account; the `deploy` key can't forward ports. `ssh -L 8080:localhost:8080 <admin>@<vps>`, then `http://localhost:8080/dashboard/`.
- **Logs.** `docker logs -f traefik` for routing and certificates; `docker compose logs -f` in an app's directory for the app.
- **Docker updates.** Held. Run `snap refresh docker` by hand in a quiet period; it restarts every container.
- **Certificate renewal.** Automatic. Traefik renews 30 days before expiry using the Cloudflare token in `/home/deploy/traefik/.env`. The token is locked to the VPS's IP, so if the box ever changes IP, renewals fail — loudly in Traefik's logs, with a month to fix it.

## Things that bit us

Each of these happened during the setup.

- **Cloudflare SSL mode Flexible.** Flexible sends traffic to the origin over plain HTTP. Traefik redirects HTTP to HTTPS, so every request loops (`ERR_TOO_MANY_REDIRECTS`). The zone is on Full; move it to Full (strict) rather than back.
- **Proxied to DNS-only too early.** A proxied record hides the origin's certificate from browsers. Switching a hostname to DNS-only, or deleting its record so the wildcard takes over, exposes whatever certificate the origin serves. Only do it once the VPS serves a valid one.
- **Cloudflare error 1014.** A proxied CNAME pointing into another Cloudflare account. It isn't an SSL problem and the SSL mode can't fix it; the record needs re-pointing or deleting.
- **Account-owned Cloudflare tokens.** `/user/tokens/verify` rejects them as invalid. Verify at `/accounts/<account id>/tokens/verify` instead; the token itself works.
- **Duplicate router names.** Two apps defining `routers.web` overwrite each other silently. Prefix every router and service name with the app's name.

## Open questions

- **Apps that ship their own code.** The example assumes an image someone else publishes. An app built from its own repository needs an image, and the choice is between building in CI and pushing to GHCR, or building on the box. Lean: build in CI and push to GHCR, with the package public — the VPS shouldn't build, and the repositories are public anyway.
- **Backup workflow shape.** Lean: a scheduled workflow per app that reuses the `VANDERBILT_*` secrets and runs a dump script specific to the app's database. The wiki's, with SQLite, comes first and becomes the template.

## Out of scope

Workers — see [CI shape](/patterns/ci-shape/). The k3s cluster, which is being phased out and takes no new apps. TeamSpeak, which runs on the VPS outside Docker and hasn't moved onto this setup.
