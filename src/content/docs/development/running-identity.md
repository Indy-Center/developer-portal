---
title: Running identity
description: Bringing up the identity Worker locally — VATSIM Connect dev credentials, .dev.vars, local D1, and how to reset it safely.
sidebar:
  order: 2
---

`identity` runs locally under `wrangler dev` on `http://localhost:8787`, against a local SQLite copy of its D1 database. Run it whenever you're working on identity itself or on a consumer that calls it — `charts` binds to it over a service binding.

## Bring-up

```bash
cd identity
npm install
cp .dev.vars.example .dev.vars   # then fill in the two credentials below
npm run db:migrate:local         # apply D1 migrations to local SQLite
npm run dev                      # wrangler dev on http://localhost:8787
```

Confirm it's serving:

```bash
curl http://localhost:8787/healthz
# {"ok":true}
```

## VATSIM Connect dev client

Login goes through VATSIM Connect, so a local identity needs a Connect OAuth client on the dev environment (`auth-dev.vatsim.net`) with this redirect URI:

```
http://localhost:8787/login/callback
```

If the team has a shared dev client, ask a maintainer for it rather than registering a new one. One shared client means one redirect URI to keep correct and one set of credentials to rotate.

## `.dev.vars`

| Key                     | Local value                            |
| ----------------------- | -------------------------------------- |
| `CONNECT_CLIENT_ID`     | From the dev client                    |
| `CONNECT_CLIENT_SECRET` | From the dev client                    |
| `CONNECT_BASE_URL`      | `https://auth-dev.vatsim.net`          |
| `CONNECT_CALLBACK_URL`  | `http://localhost:8787/login/callback` |
| `COOKIE_DOMAIN`         | `localhost`                            |
| `COOKIE_SECURE`         | `false`                                |

`.dev.vars.example` already has everything except the two credentials. `.dev.vars` is gitignored.

`wrangler.jsonc` hard-codes the production values for the last four keys — `auth.vatsim.net`, the `auth.flyindycenter.com` callback, `.flyindycenter.com`, secure cookies. Wrangler layers `.dev.vars` over those `vars` during `wrangler dev`, so your local file wins without anyone editing the config. Leave `wrangler.jsonc` alone; a local value committed there ships to production on the next deploy.

## `COOKIE_DOMAIN=localhost`

This one value switches identity into dev mode. Three things change:

- **Cookie domain.** Login sets `fic_session` with no `Domain` attribute. Browsers reject a cookie scoped to `Domain=localhost`, so login would appear to succeed and then not stick.
- **Return URLs.** `/login` accepts loopback `return_url` values — `http://localhost:*`, `http://127.0.0.1:*`, `http://[::1]:*`. Otherwise only `https://` URLs on `flyindycenter.com` pass. This is what lets a local consumer log in through local identity — [Environment](/development/environment/#charts-config) has the URL for charts.
- **Dev fixtures.** `src/dev-fixtures.ts` pins a fake active controller session or flight plan to specific CIDs, so the controlling and flying UI flows can be exercised without signing on to the network. Fixtures win over the live feeds for those CIDs.

None of it applies in production, where `COOKIE_DOMAIN` is `.flyindycenter.com`.

## Resetting local D1

Local D1 state lives in `.wrangler/state/v3/d1` inside the project. If migrations get tangled or the data is in a state you don't want, delete it and migrate again:

```bash
rm -rf .wrangler/state/v3/d1   # local SQLite only; nothing on Cloudflare is touched
npm run db:migrate:local
```

That gives you an empty database with the current schema. You'll need to log in again, since your session row went with it.

> **Why not `wrangler d1 delete` and `wrangler d1 create`.** Identity's README suggests them for untangling local D1. Don't run them. Both act on the real IndyCenter Cloudflare account, not your machine: `npx wrangler d1 delete identity_db` deletes the production database — every user, session and role — and `create` makes a new empty one with a different ID. The local state is just files under `.wrangler/`; removing those is the whole reset.
