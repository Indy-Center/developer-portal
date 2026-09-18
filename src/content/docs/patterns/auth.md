---
title: Auth
description: Wiring a Worker to identity end to end — the service binding, the types package, the hooks handle, route gates, and login and logout links. Charts is the reference.
sidebar:
  order: 1
---

A consumer reads the `fic_session` cookie, hands it to identity over a service binding, and gets back a `SessionContext` or `null`. That happens once per request in `hooks.server.ts`, and everything else reads the result from `event.locals`. [Architecture](/start-here/architecture/) covers why identity is shaped this way.

`charts` is the reference implementation; snippets below are from charts and identity, lightly annotated. `community-website` hasn't migrated to identity and runs its own session system, so don't copy auth from it.

## The contract

Identity publishes one RPC method. This is the whole typed surface, from `identity/src/client/api.ts`:

```ts
export interface IdentityRpc extends Rpc.WorkerEntrypointBranded {
  getSessionContext(token: string): Promise<SessionContext | null>;
}

export type IdentityBinding = Service<IdentityRpc>;
```

`getSessionContext` returns `null` for an unknown, expired or invalidated token. Otherwise it returns this, from `identity/src/client/session-context.ts`:

```ts
export type SessionContext = {
  user: User;
  roles: string[];
  sessionExpiresAt: Date;
  activeSession: OnlineController | null; // live vNAS controlling session
  activeFlightPlan: FlightPlan | null;
};
```

`Identity` has more methods, callable at runtime but deliberately left off `IdentityRpc`; [Architecture](/start-here/architecture/#identity) explains why. If a consumer needs one, add it to the interface in identity; don't cast.

Roles are free-form strings stored per user. There's no enum of role names in the package.

## Types from the package

Types come from `@indy-center/identity`, identity's own `package.json`. Its `exports` point at `dist/`, built from `src/client/` only, so Worker code never ships to consumers.

```json
"dependencies": {
  "@indy-center/identity": "^1.0.0"
}
```

It isn't on a registry. The consumer's lockfile links `../identity`, whose `dist/` has to be built first — see [Setup](/development/setup/#directory-layout). A published-surface test means removing or renaming an export fails `npm run typecheck`, which identity's CI runs, before it reaches a consumer.

## Declaring the binding

In the consumer's `wrangler.jsonc`, from `charts/wrangler.jsonc`:

```jsonc
"services": [
  { "binding": "IDENTITY", "service": "identity" }
]
```

No `entrypoint` field, so the binding targets identity's default export — the `Identity` class, which is where the RPC methods live. [Environment](/development/environment/#bindings-arent-env-vars) covers how the binding resolves to a locally running identity during development.

## Typing locals and the binding

`wrangler types` generates `IDENTITY: Fetcher` — it can't know the other Worker's RPC surface. Charts doesn't cast at the call site; it replaces the generated type in `App.Platform` instead. From `charts/src/app.d.ts`:

```ts
import type { IdentityBinding, SessionContext } from "@indy-center/identity";

declare global {
  namespace App {
    interface Locals {
      session: SessionContext | null;
    }
    interface Platform {
      // Swap the generated Fetcher for the typed binding. Optional, so the
      // missing-binding case has to be handled rather than assumed away.
      env: Omit<Cloudflare.Env, "IDENTITY"> & { IDENTITY?: IdentityBinding };
      cf: CfProperties;
      ctx: ExecutionContext;
    }
  }
}
```

## Loading the session

One function reads the cookie and calls identity, from `charts/src/lib/server/identity.ts`:

```ts
export async function getSessionContext(
  event: RequestEvent,
): Promise<SessionContext | null> {
  const token = event.cookies.get("fic_session");
  if (!token) {
    return null;
  }

  const identity = event.platform?.env.IDENTITY;
  if (!identity) {
    return null;
  }

  try {
    return await identity.getSessionContext(token);
  } catch (err) {
    // Identity down, mid-deploy, or not running locally. Degrade to
    // logged-out rather than failing every page.
    console.error("[charts] identity.getSessionContext threw", err);
    return null;
  }
}
```

And one handle calls it on every request, from `charts/src/hooks.server.ts`:

```ts
export const handle: Handle = async ({ event, resolve }) => {
  event.locals.session = await getSessionContext(event);
  return resolve(event);
};
```

Swallowing the error fits charts, where every page works logged out. A consumer whose pages are all gated should still catch — an uncaught throw in `handle` is a 500 on every route — and let the gate turn `null` into a login redirect.

## Gating routes

Charts gates nothing today. A gate goes in `hooks.server.ts`, after the session is loaded:

```ts
// Illustrative; the path prefix and role name are placeholders.
import { error, redirect, type Handle } from "@sveltejs/kit";
import { getSessionContext } from "$lib/server/identity";

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.session = await getSessionContext(event);

  if (event.url.pathname.startsWith("/admin")) {
    if (!event.locals.session) {
      // PUBLIC_IDENTITY_URL comes from vars in wrangler.jsonc. Run
      // `npx wrangler types` after adding it so it's on Cloudflare.Env.
      const identityUrl = event.platform?.env.PUBLIC_IDENTITY_URL;
      if (!identityUrl) {
        error(500, "PUBLIC_IDENTITY_URL is not set");
      }
      // event.url.href is absolute, which is what identity requires.
      const returnUrl = encodeURIComponent(event.url.href);
      redirect(303, `${identityUrl}/login?return_url=${returnUrl}`);
    }
    if (!event.locals.session.roles.includes("admin")) {
      error(403, "Forbidden");
    }
  }

  return resolve(event);
};
```

> **Why not `+layout.server.ts`.** A layout's server load doesn't re-run on navigation beneath it unless a dependency changes, and it runs in parallel with page loads rather than before them. Form actions run before any load, and `+server.ts` endpoints never run one. A gate there covers the first view and then quietly stops — a revoked session keeps working until reload. `handle` runs on every server request.

Hiding a button by role can live anywhere; it's cosmetic. Only the hooks gate is access control.

## Login and logout links

Identity owns both routes. Consumers link to them and never set, refresh or clear `fic_session` themselves. Both are plain `GET` links, and both require `return_url` — without it identity answers 400.

```svelte
<script lang="ts">
  import { page } from "$app/state";

  // PUBLIC_IDENTITY_URL, passed down from the root layout load as in charts.
  let { identityUrl }: { identityUrl: string } = $props();

  // Absolute on the server and in the browser, so valid from the first render.
  const returnUrl = $derived(encodeURIComponent(page.url.href));
  const loginHref = $derived(`${identityUrl}/login?return_url=${returnUrl}`);
  const logoutHref = $derived(`${identityUrl}/logout?return_url=${returnUrl}`);
</script>
```

Copy this, not `charts/src/lib/components/UserChip.svelte`. UserChip builds `return_url` from `window.location.origin`, which doesn't exist during server rendering, so the link carries a bare path until hydration and a click before then gets a 400.

Identity validates `return_url` in `validateReturnUrl` in `identity/src/auth/routes.ts`:

| Accepted                                                                                            | When                                                   |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `https://flyindycenter.com/…` and one level of subdomain, like `https://charts.flyindycenter.com/…` | Always                                                 |
| `http://localhost:*`, `http://127.0.0.1:*`, `http://[::1]:*`                                        | Only when identity runs with `COOKIE_DOMAIN=localhost` |

Anything else, including a bare path like `/airports`, is rejected.

## Logging in locally

Charts' login link points at production identity, so log in through a locally running identity instead; [Environment](/development/environment/#charts-config) has the URL. With no cookie, or with identity not running, every request is logged out.
