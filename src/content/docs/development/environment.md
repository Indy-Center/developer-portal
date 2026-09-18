---
title: Environment
description: Where local config lives in each Indy Center project, which ports the dev servers take, and the onboarding steps that are currently wrong in project READMEs.
sidebar:
  order: 3
---

Local config lives in one of two files depending on the kind of project. Dev servers take their ports from tool defaults and move aside when one is taken, so start order decides who gets which.

## `.env` or `.dev.vars`

SvelteKit projects use `.env`, read through SvelteKit's `$env/*` imports. Non-SvelteKit Workers use `.dev.vars`, which Wrangler loads during `wrangler dev`.

| Project             | Kind      | Local config                                 |
| ------------------- | --------- | -------------------------------------------- |
| `identity`          | Worker    | `.dev.vars`, from `.dev.vars.example`        |
| `discord-bot`       | Worker    | `.dev.vars`, from `.dev.vars.example`        |
| `community-website` | SvelteKit | `.env` — see [below](#community-website-env) |
| `charts`            | SvelteKit | None — see [below](#charts-config)           |

Both files are gitignored; never commit them. For identity and community-website, values come from a maintainer or from your own dev credentials. For discord-bot they come from your own Discord application and GitHub App, never the production ones — the [cheat sheet](/development/cheat-sheet/#discord-bot-webhooks) explains why.

### charts config

`charts` needs no local config to run. Its login link comes from `PUBLIC_IDENTITY_URL` in `wrangler.jsonc` `vars`, which `vite dev` loads too. That value is production identity, so the link won't bring you back to `localhost`. To log in locally, run [identity](/development/running-identity/) and open its login route directly:

```
http://localhost:8787/login?return_url=http://localhost:5173/
```

Identity sets a host-only `fic_session` cookie on `localhost`, and cookies ignore the port, so charts sees the session. Use whatever port charts got; see [Ports](#ports).

## Bindings aren't env vars

D1 databases, KV namespaces and service bindings are declared in `wrangler.jsonc` in every project, SvelteKit or not. They never go in `.env` or `.dev.vars`.

The SvelteKit apps don't need `wrangler dev` to get them. `adapter-cloudflare` v7 calls Wrangler's `getPlatformProxy()` during `vite dev` and fills `event.platform.env` with local D1, KV, `vars` and service bindings. `charts` uses the upstream adapter; `community-website` uses the org's fork, `@indy-center/adapter-cloudflare`. Both behave the same here.

Service bindings resolve locally to another Worker running on your machine, found through Wrangler's dev registry by Worker name — not by port, and never the deployed Worker. `charts` binds `IDENTITY`; if identity isn't running locally, the binding call fails, charts catches it, and every request looks logged out. Start [identity](/development/running-identity/) first.

## Ports

| Project             | Dev command    | Default port | If the default is taken                       |
| ------------------- | -------------- | ------------ | --------------------------------------------- |
| `identity`          | `wrangler dev` | 8787         | Moves up to 8788 — breaks the login callback  |
| `discord-bot`       | `wrangler dev` | 8787         | Moves up to 8788 when identity is already up  |
| `community-website` | `vite dev`     | 5173         | Moves up to 5174 when charts is already up    |
| `charts`            | `vite dev`     | 5173         | Moves up to 5174 when community-website is up |

Wrangler and Vite both take the next free port instead of failing (neither Vite config sets `strictPort`), so read the address each one prints.

The port that matters is identity's. Its VATSIM Connect redirect URI and `CONNECT_CALLBACK_URL` both name 8787. Start identity first so it gets 8787; everything else can move aside on its own. To choose a port explicitly:

```bash
# npm passes everything after `--` to the end of the script — `vite dev` in
# charts and community-website (community-website migrates first), `wrangler
# dev` in identity and discord-bot.
npm run dev -- --port 5174
```

## Known-wrong README steps

These are wrong in the project's own README today. If you hit them, you didn't break anything.

### community-website env

The README says `cp .env.example .env`. There's no `.env.example` in the repository. Create `.env` by hand with these keys and get the values from a maintainer:

```bash
# Read only by drizzle.config.ts, for drizzle-kit and db:studio.
DATABASE_URL=
CONNECT_CLIENT_ID=
CONNECT_CLIENT_SECRET=
CONNECT_BASE_URL=
CONNECT_CALLBACK_URL=
DISCORD_WEBHOOK_TECH_TEAM_ALERTS=
DISCORD_WEBHOOK_SENIOR_STAFF_ALERTS=
VATUSA_API_KEY=
PUBLIC_CONSOLA_LEVEL=
```

Two more mismatches in the same README:

- **Layout.** It describes a `website/` subdirectory and says to `cd website`. The GitHub repository is the website alone, at the root; run everything from the clone's top level.
- **Identity.** It describes an `IDENTITY` binding and auth through identity. Neither exists yet — `community-website` still runs its own session system, so it doesn't need identity running locally.

### charts identity binding

The README says the `IDENTITY` service binding is declared in `wrangler.jsonc` but not called, and a comment in `wrangler.jsonc` calls it "unused in v1". Both are stale: `src/hooks.server.ts` calls it on every request to load the session.
