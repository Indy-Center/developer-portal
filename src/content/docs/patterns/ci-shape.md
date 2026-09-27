---
title: CI shape
description: The two GitHub Actions workflows an Indy Center project needs — checks on pull requests, deploy on merge — with the deploy step for each place we run code, the secrets, D1 migrations, and gating deploy on checks.
sidebar:
  order: 5
---

A project gets two workflows: `ci.yml` runs checks on every pull request and on `main`, and `build-and-deploy.yml` deploys on every push to `main`. The checks and the wiring between the two workflows are the same everywhere; only the deploy step depends on where the project runs.

| Target                  | Runs                                                        | Deploy step                                              | Status                             |
| ----------------------- | ----------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------- |
| Cloudflare Workers      | Anything that can be a Worker                               | `wrangler-action`                                        | Default for new projects           |
| Vanderbilt VPS (Docker) | Long-running servers and self-hosted apps — Wiki.js, Moodle | rsync + `docker compose up -d` over SSH                  | Active                             |
| k3s cluster (ArgoCD)    | `controller-tools` only                                     | Push an image to GHCR; ArgoCD Image Updater rolls it out | Being phased out — no new projects |

Start with a Worker. Reach for the VPS when the thing needs a long-running process or is someone else's software shipped as a container. Don't start anything new on k3s.

## Checks

From `developer-portal/.github/workflows/ci.yml`:

```yaml
name: Tests and Verification
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
      - run: npm ci
      - run: npm run format:check
      - run: npm run check
      - run: npm run build
      - run: npm test
```

The steps are the project's own scripts — SvelteKit and Astro have `check`, a plain Worker has `typecheck`. Run formatting, types, build and tests in that order; format is the cheapest to fail.

Copy the triggers exactly: `pull_request` covers every commit on a pull request, `push` to `main` covers what merged.

```yaml
# Don't do this. A commit pushed to a pull request's branch is both a push to
# that branch and an update to the pull request, so every check runs twice.
on:
  push:
    branches: ["**"]
  pull_request:
    branches: [main]
```

Identity's `ci.yml` has this shape today.

A project that deploys to the VPS also checks its compose file, after its own checks, so a typo fails on the pull request rather than on the box:

```yaml
- run: docker compose -f deploy/docker-compose.yml config -q
# Fails on a mistyped image or tag before it reaches the VPS.
- run: docker compose -f deploy/docker-compose.yml pull --quiet
```

`docker-infrastructure`'s `ci.yml` goes further for Traefik itself: it starts the stack on the runner and checks that it stays up and routes a test app.

## Deploy to Workers

From `developer-portal/.github/workflows/build-and-deploy.yml`:

```yaml
name: Build and Deploy
on:
  push:
    branches: [main]
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
      - run: npm ci
      - name: Build
        run: npm run build
      - name: Deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_WORKERS_API_KEY }}
```

SvelteKit and Astro projects need the build step, since `wrangler deploy` uploads their build output. A plain Worker like identity skips it; Wrangler bundles `main` itself. `wrangler-action` needs no `accountId` input because `wrangler.jsonc` sets `account_id`; keep that line in any new project.

## Deploy to the VPS

An app on the Vanderbilt VPS keeps everything the box needs in a `deploy/` folder: its `docker-compose.yml`, plus any config files it mounts. The deploy copies that folder to `~/apps/<repo name>/` as the `deploy` user and runs Compose there. From [`docker-infrastructure/examples/app/.github/workflows/build-and-deploy.yml`](https://github.com/Indy-Center/docker-infrastructure/blob/main/examples/app/.github/workflows/build-and-deploy.yml), after the SSH setup step:

```yaml
env:
  # The app's directory on the VPS: /home/deploy/apps/<repo name>/.
  APP: ${{ github.event.repository.name }}
steps:
  # ...checkout, then "Set up SSH" from the VANDERBILT_* secrets

  # --delete removes files dropped from deploy/; excluded files (.env) are never deleted.
  - run: rsync -rlz --delete --exclude=.env --exclude=.env.example deploy/ "vps:apps/$APP/"

  # ..."Write .env": every ENV_* repo secret and variable becomes a line in ~/apps/<app>/.env

  - run: |
      ssh vps "APP=$APP bash -s" <<'EOF'
      set -e
      cd ~/apps/"$APP"
      docker compose pull --quiet
      docker compose up -d --remove-orphans
      sleep 15
      # Healthy = nothing restarting and no restarts since start.
      if docker inspect -f '{{.State.Restarting}} {{.RestartCount}}' $(docker compose ps -aq) | grep -qv '^false 0$'; then
        docker compose logs --tail 50
        exit 1
      fi
      EOF
```

Copy the whole workflow rather than this excerpt; it reads the app name from the repository, so it needs no edits. [Deploying to the VPS](/patterns/vps-apps/) covers the rest of what a new app needs: the compose labels that route it through Traefik, DNS and certificates, runtime secrets and backups.

> **Why rsync and Compose over SSH.** Traefik's own deploy in `docker-infrastructure` works this way, and it's been through a live cutover. Building images in CI and having the box pull them is the other common shape, and an app that ships its own code may want it later. Most of what runs on the VPS is someone else's image — Wiki.js, Moodle — so there's nothing to build, and copying a folder is the whole deploy.

## Deploy to k3s

The k3s cluster is being phased out. It runs one maintained service, `controller-tools` at `tools.flyindycenter.com`, and goes away once its Workers rewrite, `tools`, replaces it. This section describes how that deploy works so it can be kept running; don't copy it.

`controller-tools` has no `ci.yml`. Its workflows only build images and push them to GHCR:

- **`build-development.yml`.** Every push to `main` builds `<run number>-next`, `latest` and the commit SHA.
- **`build-production.yml`.** Run by hand (`workflow_dispatch`); builds `<run number>-main`.

Nothing in the workflow touches the cluster. ArgoCD Image Updater, configured in the `infrastructure` repository's `apps/ict/application-production.yaml`, watches GHCR and rolls production to the newest tag matching `^[0-9]+-main$`. A deploy is "run Build Production"; a rollback means pinning an older tag in `infrastructure`.

## Secrets

Each target needs a different kind of deploy credential, and none of them is the running app's own secrets.

- **Workers.** One repository secret, `CLOUDFLARE_WORKERS_API_KEY`: a Cloudflare API token with Workers Scripts:Edit, plus D1:Edit when the project has a database. A maintainer adds it as a repository secret. Runtime secrets such as identity's VATSIM Connect client secret are Worker secrets, set with `npx wrangler secret put`, and never appear in a workflow or in `wrangler.jsonc`.
- **VPS.** Four organization secrets, `VANDERBILT_HOST`, `VANDERBILT_DEPLOY_USER`, `VANDERBILT_DEPLOY_SSH_KEY` and `VANDERBILT_KNOWN_HOSTS`, limited to selected repositories. An org admin adds a new app's repository to all four. Runtime values are repository secrets named `ENV_<NAME>`, which the deploy writes to the app's `.env` on the box; [Deploying to the VPS](/patterns/vps-apps/#secrets) has the details.
- **k3s.** The workflow pushes to GHCR with the built-in `GITHUB_TOKEN`. The cluster pulls with a sealed pull secret kept in `infrastructure`.

> **Why the VPS secrets are org-level.** Every app on the VPS deploys as the same `deploy` user with the same key, so one set of secrets means one place to rotate it. They're limited to selected repositories rather than all of them because `deploy` is in the `docker` group, which makes the key root-equivalent on the box.

## D1 migrations

Workers only. A project with D1 applies migrations in the deploy workflow, before the deploy step. From `identity/.github/workflows/build-and-deploy.yml`:

```yaml
- name: Apply D1 migrations
  uses: cloudflare/wrangler-action@v3
  with:
    apiToken: ${{ secrets.CLOUDFLARE_WORKERS_API_KEY }}
    command: d1 migrations apply identity_db --remote

- name: Deploy
  uses: cloudflare/wrangler-action@v3
  with:
    apiToken: ${{ secrets.CLOUDFLARE_WORKERS_API_KEY }}
```

Migrate first, so new code never runs against the old schema. The cost is a window where the old code runs against the new schema — the time between the two steps, or indefinitely if the deploy step fails. Write migrations the old code survives: add columns and tables, and remove them in a later deploy once nothing reads them.

## Gating deploy on checks

The two workflows above are independent. A push to `main` starts both at once, and the deploy doesn't wait for or look at the checks. A pull request that fails [its checks](/agreements/ci-checks/) shouldn't be merged, but a direct push to `main`, or two pull requests that pass alone and break together, still deploys.

To make deploy depend on checks, have the deploy workflow call CI as a reusable workflow. `teamspeak-bot` and `docker-infrastructure` do this. Adapted from `teamspeak-bot`'s `ci.yml` and `deploy.yml`:

```yaml
# ci.yml — no push trigger. On main, CI runs inside the deploy workflow
# instead, so it still runs exactly once per commit.
on:
  pull_request:
  workflow_call:
# ...jobs unchanged
```

```yaml
# build-and-deploy.yml
on:
  push:
    branches: [main]

jobs:
  ci:
    uses: ./.github/workflows/ci.yml

  build-and-deploy:
    needs: ci # skipped if any check fails
    runs-on: ubuntu-latest
    steps:
      # ...same steps as above
```

Every VPS deploy is gated this way; the example app's workflows already are. `teamspeak-bot` deploys to the VPS with its own older forced-command script, so for VPS deploy steps copy `docker-infrastructure`'s example rather than `teamspeak-bot`'s.
