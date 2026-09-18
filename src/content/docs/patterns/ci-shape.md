---
title: CI shape
description: The two GitHub Actions workflows an Indy Center Worker needs — checks on pull requests, deploy on merge — plus the deploy token, D1 migrations, and gating deploy on checks.
sidebar:
  order: 4
---

A project gets two workflows: `ci.yml` runs checks on every pull request and on `main`, and `build-and-deploy.yml` deploys to Cloudflare on every push to `main`. This repository's are the model to copy; both live in [`.github/workflows/`](https://github.com/Indy-Center/developer-portal/tree/main/.github/workflows).

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

## Deploy

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

## Secrets

The deploy workflow needs one repository secret, `CLOUDFLARE_WORKERS_API_KEY`: a Cloudflare API token with Workers Scripts:Edit, plus D1:Edit when the project has a database. A maintainer adds it as a repository secret.

That token deploys the Worker; it isn't the Worker's own secrets. Runtime secrets such as identity's VATSIM Connect client secret are Worker secrets, set with `npx wrangler secret put`, and never appear in a workflow or in `wrangler.jsonc`.

## D1 migrations

A project with D1 applies migrations in the deploy workflow, before the deploy step. From `identity/.github/workflows/build-and-deploy.yml`:

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

To make deploy depend on checks, have the deploy workflow call CI as a reusable workflow. `teamspeak-bot` does this. Adapted from its `ci.yml` and `deploy.yml`:

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

`teamspeak-bot` deploys a container to the VPS rather than a Worker, so only the workflow wiring carries over, not its deploy steps.
