---
title: README template
description: The Indy Center README layout, ready to copy, and when to use it.
sidebar:
  order: 5
---

This is the org's README layout. Use it when starting a new repository, and when a README has drifted far enough that patching it would take longer than rewriting it. Copy the block below into `README.md`, replace the placeholders, and delete the sections the template's own notes tell you to omit.

The README is the project's source of truth ([Projects](/projects/)), so the opening sentence says what the project does and who calls it, and the HTTP surface and bindings list everything. Keeping it accurate is part of the [definition of done](/agreements/definition-of-done/).

<!-- prettier-ignore -->
````markdown
# project-name

One sentence: what this project is and what it does. Who calls it and how (HTTP, RPC, cron, etc.).

[![Build and Deploy](https://github.com/Indy-Center/PROJECT/actions/workflows/build-and-deploy.yml/badge.svg)](https://github.com/Indy-Center/PROJECT/actions/workflows/build-and-deploy.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## HTTP surface

List every route. One bullet per route, format: `` `METHOD /path` — what it does ``.

- `GET /healthz` — liveness check.
- `POST /example` — describe the request and response.

> Omit this section if the project exposes no HTTP surface (pure RPC, cron-only, etc.).

## Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `BINDING_NAME` | Service / D1 / KV / Queue | What it's for |

> Omit if no bindings.

## Project layout

One bullet per meaningful file or directory. Skip generated files (`node_modules`, `.svelte-kit`, `dist`).

- `src/index.ts` — entry point; describe what it wires up.
- `src/module/` — describe the domain or responsibility.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars   # fill in secrets
npm run dev                      # http://localhost:8787
npm test
```

Add any non-obvious setup steps here (OAuth redirect URIs, local DB migration, fake fixtures, etc.).

## Tests

```bash
npm test
npm run typecheck
```

> Omit if covered above and there's nothing extra to say.

## Deployment

How deploys happen (CI on push to main, manual wrangler deploy, etc.). What secrets need to be set and where.

```bash
npm run deploy
```

## Disclaimer

We are not affiliated with the FAA or any aviation governing body. This software is for flight simulation use on the [VATSIM](https://www.vatsim.net) network.
````

A few things the template leaves implicit:

- **Badge.** Replace `PROJECT` in both badge URLs with the repository name. The badge reads `build-and-deploy.yml`, so it assumes the workflow layout in [CI shape](/patterns/ci-shape/).
- **Local development.** The block shows the plain-Worker flow with `.dev.vars`. A SvelteKit project uses `.env` and `vite dev` instead — see [Environment](/development/environment/).
- **Bindings.** List service bindings too, with the Worker they point at. For a Worker others call over RPC, name the published interface — identity's is `IdentityRpc`.
