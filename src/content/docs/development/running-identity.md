---
title: Running identity
description: Bringing up the identity Worker locally for work on identity itself — VATSIM Connect dev credentials, .dev.vars, local D1, and how to reset it safely.
sidebar:
  order: 2
---

`identity` runs locally under `wrangler dev` on `http://localhost:8787`, against a local SQLite copy of its D1 database. Run it when you're changing identity itself.

Once identity's OAuth endpoints land (identity 1.1.0, on its `feat/http-transport` branch), apps on `localhost` log in through deployed identity, so working on charts or any other consumer won't need a local identity. [Auth](/patterns/auth/#local-development) covers that flow. Until then, a local charts still needs identity running here.

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

`.dev.vars.example` already has everything except the two credentials. Until 1.1.0 lands it also carries two cookie settings that the release removes; copy them as they are. `.dev.vars` is gitignored.

`wrangler.jsonc` hard-codes the production values for the last two keys: `auth.vatsim.net` and the `auth.flyindycenter.com` callback. Wrangler layers `.dev.vars` over those `vars` during `wrangler dev`, so your local file wins without anyone editing the config. Leave `wrangler.jsonc` alone; a local value committed there ships to production on the next deploy.

## Logging in to local identity

Identity 1.1.0 has no dev mode. It runs the same code locally as in production, and three things make that work on `http://localhost:8787`:

- **Identity's cookie.** Identity remembers the user with `__Host-identity_session`, host-only and `Secure`. Browsers accept `Secure` cookies on `http://localhost`, so it sticks without a local override.
- **Return addresses.** `/oauth/authorize` always accepts loopback `redirect_uri` values (`http://localhost`, `http://127.0.0.1` and `http://[::1]`, on any port) alongside `flyindycenter.com`. A local consumer points at local identity by building its client with `createIdentityClient({ baseUrl: "http://localhost:8787" })`.
- **Dev fixtures.** The fake controlling session and flight plan used to exercise charts' controlling and flying UI move to charts, under its dev flag. Identity has none.

To test a login by hand, open the authorize URL in a browser. After VATSIM, identity redirects to the return address with `?code=…`:

```
http://localhost:8787/oauth/authorize?response_type=code&client_id=dev&redirect_uri=http://localhost:5173/
```

## Resetting local D1

Local D1 state lives in `.wrangler/state/v3/d1` inside the project. If migrations get tangled or the data is in a state you don't want, delete it and migrate again:

```bash
rm -rf .wrangler/state/v3/d1   # local SQLite only; nothing on Cloudflare is touched
npm run db:migrate:local
```

That gives you an empty database with the current schema. You'll need to log in again, since your session row went with it.

> **Why not `wrangler d1 delete` and `wrangler d1 create`.** Identity's README suggests them for untangling local D1. Don't run them. Both act on the real IndyCenter Cloudflare account, not your machine: `npx wrangler d1 delete identity_db` deletes the production database — every user, session and role — and `create` makes a new empty one with a different ID. The local state is just files under `.wrangler/`; removing those is the whole reset.
