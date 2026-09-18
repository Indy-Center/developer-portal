---
title: Cheat sheet
description: The commands that come up across Indy Center projects, which projects have each script, and how to develop against discord-bot's webhooks.
sidebar:
  order: 4
---

These are the commands that come up across Indy Center projects. Run them from inside the project directory; not every project has every script:

| Script             | identity | charts | community-website | discord-bot |
| ------------------ | :------: | :----: | :---------------: | :---------: |
| `dev`              |   yes    |  yes   |        yes        |     yes     |
| `test`             |   yes    |  yes   |                   |     yes     |
| `cf-typegen`       |   yes    |        |        yes        |     yes     |
| `db:generate`      |   yes    |        |        yes        |             |
| `db:migrate:local` |   yes    |        |        yes        |             |

```bash
# Show the logged-in user and confirm IndyCenter is the active account.
npx wrangler whoami

# Regenerate the Env types after changing bindings or vars in wrangler.jsonc,
# where the project has the script. Commit the regenerated file.
npm run cf-typegen

# After editing a Drizzle schema: write a migration, then apply it locally.
# identity and community-website only.
npm run db:generate
npm run db:migrate:local

# community-website's `npm run dev` already runs db:migrate:local first.
# Its `npm run db:migrate` (no :local) applies to the production database.

# Local D1 wedged: delete local state only — never wrangler d1 delete (see Running identity).
rm -rf .wrangler/state/v3/d1 && npm run db:migrate:local

# Pin a port. Environment explains why identity should start first.
npm run dev -- --port 5174
```

Identity's full bring-up is on [Running identity](/development/running-identity/); ports and env files are on [Environment](/development/environment/).

## discord-bot webhooks

`discord-bot` only acts on inbound webhooks — Discord interactions at `POST /discord` and a GitHub App at `POST /github`. A plain `npm run dev` serves on localhost, which neither service can reach.

Use your own Discord application and GitHub App for local development, never the production ones. Discord allows one Interactions Endpoint URL per application, so pointing the production app at your tunnel sends every live `/accept`, `/deny` and `/done` to your laptop and takes the real bot offline until someone points it back. The production GitHub App's webhook works the same way.

Two ways to get webhooks in:

```bash
# Run on Cloudflare's network instead of locally. Needs `wrangler login`.
# The KV binding has only a production id and no preview_id, so this reads
# and writes the live issue-to-thread map.
npx wrangler dev --remote

# Or keep it local and tunnel it. Pin the port so the tunnel can't land on
# identity's 8787, then point your own Discord app's Interactions Endpoint URL
# and your own GitHub App's webhook URL at the tunnel's HTTPS address.
npm run dev -- --port 8789
cloudflared tunnel --url http://localhost:8789   # or: ngrok http 8789
```

After editing `src/commands.ts`, re-register the slash commands with Discord:

```bash
# PUTs the full command list to the application named in .dev.vars, replacing
# every global command on it. Make sure .dev.vars names your own app.
npm run register-commands
```
