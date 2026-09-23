---
title: Worker patterns
description: The four shapes of Cloudflare Worker in the Indy Center org today, the repository that shows each one, and what decides between them.
sidebar:
  order: 3
---

Indy Center's Workers come in four shapes worth copying. Three things pick the shape: whether it serves pages or only routes, whether other Workers call it over RPC, and whether it needs a handler besides `fetch`, like a cron or an RPC export. Start a new project from the repository in the matching row. Two are simpler than any of these — `airports-redirect-worker` is a single `fetch` handler, and this site is static assets with no Worker code.

| Shape                                     | Example             | `main` in `wrangler.jsonc`          | HTTP surface             | RPC surface   |
| ----------------------------------------- | ------------------- | ----------------------------------- | ------------------------ | ------------- |
| SvelteKit, upstream adapter               | `charts`            | `.svelte-kit/cloudflare/_worker.js` | Pages and endpoints      | None          |
| SvelteKit, org adapter fork + own wrapper | `community-website` | `src/worker.ts`                     | Pages and endpoints      | None today    |
| Hono + `WorkerEntrypoint`                 | `identity`          | `src/index.ts`                      | OAuth routes, `/healthz` | `IdentityRpc` |
| Hono only                                 | `discord-bot`       | `src/index.ts`                      | Webhooks                 | None          |

## SvelteKit, upstream adapter

`charts` uses `@sveltejs/adapter-cloudflare` as-is. `wrangler.jsonc`'s `main` points at the adapter's build output, and the Worker is only SvelteKit's `fetch`. This is the default for anything with pages. It consumes identity over a service binding; [Auth](/patterns/auth/) covers that wiring.

## SvelteKit with its own entrypoint

A SvelteKit app that also needs a cron trigger, or an RPC surface of its own, needs a Worker entrypoint SvelteKit doesn't generate. The upstream adapter uses `main` as its build output path, so pointing `main` at your own file gets it overwritten on `vite build`. The org's fork, [`@indy-center/adapter-cloudflare`](https://github.com/Indy-Center/adapter-cloudflare), always writes to `.svelte-kit/cloudflare/_worker.js` and leaves `main` free for a wrapper.

`community-website` uses it for a cron. From `community-website/src/worker.ts`:

```ts
import { drizzle } from "$lib/server/db";
import { runProcessRoster } from "$lib/server/triggers/processRoster.js";
import { setEnv } from "@indy-center/adapter-cloudflare/env-shim";
import sv from "../.svelte-kit/cloudflare/_worker.js";

export default {
  fetch: sv.fetch,

  async scheduled(_event, env, _ctx) {
    setEnv(env as unknown as Record<string, string | undefined>);
    await runProcessRoster(drizzle(env.DB));
  },
} satisfies ExportedHandler<Env>;
```

The cron schedule is `"0-59/5 * * * *"` under `triggers` in its `wrangler.jsonc`. The same wrapper can export a `WorkerEntrypoint` class for RPC; `community-website` doesn't have one. `setEnv` fills the fork's `$env/dynamic/*` shim, since Wrangler bundles this file rather than Vite; the fork's README covers the alias setup.

> **Why a fork.** The fix is [sveltejs/kit#14029](https://github.com/sveltejs/kit/pull/14029), which the fork's README expects to land properly in Kit 3. Until then the fork is how a SvelteKit app here gets a `scheduled` handler or an RPC export alongside its pages. Use the upstream adapter unless you need the wrapper.

## Hono + `WorkerEntrypoint`

A Worker that other Workers call over RPC, and that also needs routes reachable from the internet, makes its default export a `WorkerEntrypoint` class and hands `fetch` to a Hono app. From `identity/src/index.ts`, trimmed:

```ts
import { WorkerEntrypoint } from "cloudflare:workers";
import { buildApp } from "./app";
import type { IdentityRpc } from "./client/api";

const app = buildApp(); // Hono: /oauth/*, /login/callback, /logout, /healthz

export default class Identity
  extends WorkerEntrypoint<Cloudflare.Env>
  implements IdentityRpc
{
  // Public HTTP goes to Hono.
  fetch(request: Request) {
    return app.fetch(request, this.env, this.ctx);
  }

  // Every other public method is callable over a service binding.
  async getSessionContext(token: string): Promise<SessionContext | null> {
    // ...
  }
}
```

Browsers reach the Hono routes at `auth.flyindycenter.com`; other Workers reach the class methods through a service binding, which isn't on the internet at all. `implements IdentityRpc` holds the class to the published interface — it can have more methods, never fewer.

Publish the types a consumer compiles against from `src/client/`, as identity does; [Auth](/patterns/auth/#the-client-library) covers the package.

## Hono only

`discord-bot` has no callers but webhooks, so its default export is the Hono app itself. From `discord-bot/src/index.ts`:

```ts
const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.text("discord-bot ok"));
app.route("/discord", discordApp); // Discord interactions
app.route("/github", githubApp); // GitHub App webhooks

export default app;
```

A service binding to this Worker would only get `fetch`. If another Worker ever needs to call it, convert it to the identity shape — a `WorkerEntrypoint` default export whose `fetch` delegates to the same Hono app — so the webhooks keep working unchanged.

Considered, not chosen: giving a Hono-only Worker a JSON route for other Workers to call. That's HTTP between Workers, which [RPC vs Queue](/patterns/rpc-vs-queue/) rules out.
