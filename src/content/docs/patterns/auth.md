---
title: Auth
description: Adding "Connect with VATSIM" to an Indy Center app through identity's OAuth endpoints and the @indy-center/identity client, with SvelteKit, Express, Flask and browser-only examples.
sidebar:
  order: 1
---

:::note[Coming soon]
Identity is moving to the OAuth-based login described here, and charts will be the first app on it. The `/oauth` endpoints and the 1.1.0 client are landing on identity's `feat/http-transport` branch, so neither is deployed or published yet.
:::

Identity (`auth.flyindycenter.com`) does the VATSIM login for every Indy Center app. An app sends the user to identity, gets a code back, and trades it for a session token of its own. This page is for anyone adding login to an app. It works the same deployed and on `localhost`. [Login flow](/patterns/auth-flow/) explains what happens underneath.

`charts` will be the first app on this flow and the reference consumer. `community-website` still runs its own session system, so don't copy auth from it.

## The four steps

Every app does the same four things:

1. **Link to identity.** Send the user to identity with the address to come back to. If identity doesn't know them yet, they log in on VATSIM's page first.
2. **Trade the code.** The user comes back with `?code=…`. Swap it for a session token.
3. **Keep the token.** That token is the user's login in your app.
4. **Ask who they are.** On each request, hand identity the token and get back the user, their roles, and what they're doing on the network.

Steps 2 and 4 are HTTP calls to identity, and logging out is a third. In JavaScript the client library makes them. In other languages you make them yourself; the [Flask example](#flask) shows how.

## Where the token goes

If your app has a server, keep the token in an HttpOnly cookie on your own origin. The browser sends it back on every request and page scripts can't read it. A browser-only app has nowhere else to put it, so it keeps the token in `localStorage`. The examples below show both.

The cookie convention is `fic_session`, `HttpOnly; SameSite=Lax; Path=/`, and `Secure` over HTTPS. The client library exports the name as `SESSION_COOKIE` and the attributes as `sessionCookieOptions({ expiresAt, secure })`, which SvelteKit's `cookies.set`, Express's `res.cookie` and Hono's `setCookie` all accept as they are. Identity never sets this cookie; each app sets it on its own origin, with no `Domain`.

## The session context

`getSessionContext(token)` returns `null` for an unknown, expired or revoked token. Otherwise it returns this, from `identity/src/client/session-context.ts`:

```ts
export type SessionContext = {
  user: User;
  roles: string[];
  sessionExpiresAt: Date;
  activeSession: OnlineController | null; // live vNAS controlling session
  activeFlightPlan: FlightPlan | null;
};
```

`GET /oauth/userinfo` returns the same object as JSON, with ISO date strings and top-level `sub`, `email` and `name` added.

Roles are free-form strings stored per user. There's no enum of role names in the package.

## The client library

`@indy-center/identity` is identity's own package, built from `src/client/` and published to npm from identity's CI. It runs in Workers, Node and the browser.

```bash
npm install @indy-center/identity@^1.1.0
```

One factory picks the transport. The consumer chooses it; the library never sniffs.

```ts
import { createIdentityClient } from "@indy-center/identity";

const identity = createIdentityClient(); // HTTPS to https://auth.flyindycenter.com
const identity = createIdentityClient({ binding: env.IDENTITY }); // Worker: RPC over the service binding
```

The client has six methods:

- **`loginUrl(redirectUri)`.** The identity URL for step 1. Pass the absolute URL of the current page.
- **`completeLogin(url)`.** Steps 2 and 3. Returns `null` when `url` has no `code`. Otherwise it trades the code and returns `{ token, expiresAt, session, redirectTo }`, where `redirectTo` is the same page with `code` and `state` removed.
- **`getSessionContext(token)`.** Step 4. Returns `SessionContext | null`.
- **`logout(token)`.** Revokes this app's session only.
- **`logoutUrl(returnUrl)`.** The URL for identity's global logout.
- **`exchangeCode(code, redirectUri)`.** The raw exchange behind `completeLogin`, for callers that handle the URL themselves.

Errors other than an invalid token surface as `IdentityError`.

## SvelteKit

One module constructs the client. It holds the only environment-dependent line in the app:

```ts
// src/lib/server/identity.ts
import { dev } from "$app/environment";
import type { RequestEvent } from "@sveltejs/kit";
import { createIdentityClient } from "@indy-center/identity";

export function identityFor(event: RequestEvent) {
  // Under vite dev the binding resolves to a local identity that isn't
  // running, so dev goes over HTTPS to deployed identity instead.
  return createIdentityClient(
    dev ? {} : { binding: event.platform?.env.IDENTITY },
  );
}
```

The whole login goes in the server hook, which runs before every request:

```ts
// src/hooks.server.ts
import { redirect, type Handle } from "@sveltejs/kit";
import { SESSION_COOKIE, sessionCookieOptions } from "@indy-center/identity";
import { identityFor } from "$lib/server/identity";

export const handle: Handle = async ({ event, resolve }) => {
  const identity = identityFor(event);

  // Steps 2 and 3: back from identity with a code? Trade it and keep the token.
  const login = await identity.completeLogin(event.url);
  if (login) {
    event.cookies.set(
      SESSION_COOKIE,
      login.token,
      sessionCookieOptions({
        expiresAt: login.expiresAt,
        secure: event.url.protocol === "https:",
      }),
    );
    redirect(303, login.redirectTo); // same page, without code and state
  }

  // Step 4: who is this? null when nobody is logged in.
  const token = event.cookies.get(SESSION_COOKIE);
  try {
    event.locals.session = token
      ? await identity.getSessionContext(token)
      : null;
  } catch (err) {
    // An uncaught throw in handle is a 500 on every route. Degrade to
    // logged out while identity is down or mid-deploy.
    console.error("identity.getSessionContext threw", err);
    event.locals.session = null;
  }

  return resolve(event);
};
```

Step 1 is a link. Build it on the server, so the return address is absolute from the first render, and pass it to the page:

```ts
// src/routes/+layout.server.ts
import { identityFor } from "$lib/server/identity";

export function load(event) {
  return {
    session: event.locals.session,
    loginUrl: identityFor(event).loginUrl(event.url.href), // bring them back to this page
  };
}
```

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  let { data, children } = $props();
</script>

{#if data.session}
  Logged in as {data.session.user.vatsimData.personal.name_first}
  <a href="/logout">Log out</a>
{:else}
  <a href={data.loginUrl}>Connect with VATSIM</a>
{/if}

{@render children()}
```

Logging out revokes the token at identity and deletes the cookie:

```ts
// src/routes/logout/+server.ts
import { redirect } from "@sveltejs/kit";
import { SESSION_COOKIE } from "@indy-center/identity";
import { identityFor } from "$lib/server/identity";

export async function GET(event) {
  const token = event.cookies.get(SESSION_COOKIE);
  if (token) await identityFor(event).logout(token);
  event.cookies.delete(SESSION_COOKIE, { path: "/" });
  redirect(303, "/");
}
```

### Declaring the binding

A deployed Worker reaches identity in-process over a service binding instead of HTTPS. In the consumer's `wrangler.jsonc`, from `charts/wrangler.jsonc`:

```jsonc
"services": [
  { "binding": "IDENTITY", "service": "identity" }
]
```

No `entrypoint` field, so the binding targets identity's default export, the `Identity` class. `wrangler types` generates `IDENTITY: Fetcher`, since it can't know the other Worker's RPC surface. Replace it with the package's `IdentityBinding` rather than casting at the call site. From `charts/src/app.d.ts`:

```ts
import type { IdentityBinding, SessionContext } from "@indy-center/identity";

declare global {
  namespace App {
    interface Locals {
      session: SessionContext | null;
    }
    interface Platform {
      // Swap the generated Fetcher for the typed binding.
      env: Omit<Cloudflare.Env, "IDENTITY"> & { IDENTITY?: IdentityBinding };
      cf: CfProperties;
      ctx: ExecutionContext;
    }
  }
}
```

`createIdentityClient({ binding: undefined })` behaves like `createIdentityClient()`, so a missing binding falls back to HTTPS.

### Gating routes

A gate goes in `hooks.server.ts`, after the session is loaded:

```ts
// Illustrative; the path prefix and role name are placeholders.
if (event.url.pathname.startsWith("/admin")) {
  if (!event.locals.session) {
    redirect(303, identityFor(event).loginUrl(event.url.href));
  }
  if (!event.locals.session.roles.includes("admin")) {
    error(403, "Forbidden");
  }
}
```

> **Why not `+layout.server.ts`.** A layout's server load doesn't re-run on navigation beneath it unless a dependency changes, and it runs in parallel with page loads rather than before them. Form actions run before any load, and `+server.ts` endpoints never run one. A gate there covers the first view and then quietly stops — a revoked session keeps working until reload. `handle` runs on every server request.

Hiding a button by role can live anywhere; it's cosmetic. Only the hooks gate is access control.

## Express

Same library, same four steps. One middleware trades the code and looks up the user, and routes read `req.session`.

```bash
npm install express cookie-parser @indy-center/identity
```

```js
// server.js
import express from "express";
import cookieParser from "cookie-parser";
import {
  createIdentityClient,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@indy-center/identity";

const identity = createIdentityClient();
const app = express();
// Behind a TLS-terminating proxy, req.secure and req.protocol are only right
// with trust proxy set; otherwise the cookie loses Secure and the return
// address says http.
app.set("trust proxy", true);
app.use(cookieParser());

app.use(async (req, res, next) => {
  const url = new URL(req.originalUrl, `${req.protocol}://${req.get("host")}`);

  // Steps 2 and 3
  const login = await identity.completeLogin(url);
  if (login) {
    res.cookie(
      SESSION_COOKIE,
      login.token,
      sessionCookieOptions({ expiresAt: login.expiresAt, secure: req.secure }),
    );
    return res.redirect(login.redirectTo);
  }

  // Step 4
  const token = req.cookies[SESSION_COOKIE];
  req.session = token ? await identity.getSessionContext(token) : null;
  next();
});

app.get("/", (req, res) => {
  if (!req.session) {
    // Step 1
    const loginUrl = identity.loginUrl(`${req.protocol}://${req.get("host")}/`);
    return res.send(`<a href="${loginUrl}">Connect with VATSIM</a>`);
  }
  res.send(
    `Hello ${req.session.user.vatsimData.personal.name_first} <a href="/logout">Log out</a>`,
  );
});

app.get("/logout", async (req, res) => {
  const token = req.cookies[SESSION_COOKIE];
  if (token) await identity.logout(token);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.redirect("/");
});

app.listen(3000);
```

## Flask

There's no Python client, so this example makes the HTTP calls itself. It does what the JavaScript client does.

```bash
pip install flask requests
```

```python
# app.py
from urllib.parse import urlencode
import requests
from flask import Flask, request, redirect, make_response

IDENTITY = "https://auth.flyindycenter.com"
RETURN_TO = "http://localhost:5000/"   # where identity sends the user back to
CLIENT_ID = "my-flask-app"             # any name for your app; identity treats it as a label
COOKIE = "fic_session"
app = Flask(__name__)


def current_session():
    """Step 4: hand identity the token, get the user back. None if not logged in."""
    token = request.cookies.get(COOKIE)
    if not token:
        return None
    r = requests.get(f"{IDENTITY}/oauth/userinfo", headers={"Authorization": f"Bearer {token}"})
    return r.json() if r.ok else None


@app.route("/")
def home():
    # Steps 2 and 3: back from identity with a code? Trade it and keep the token in a cookie.
    code = request.args.get("code")
    if code:
        r = requests.post(f"{IDENTITY}/oauth/token", data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": RETURN_TO,  # must match the one sent in step 1
            "client_id": CLIENT_ID,
        })
        r.raise_for_status()
        body = r.json()
        resp = make_response(redirect("/"))
        resp.set_cookie(COOKIE, body["access_token"], max_age=body["expires_in"],
                        httponly=True, samesite="Lax", secure=request.is_secure)
        return resp

    session = current_session()
    if session:
        name = session["user"]["vatsimData"]["personal"]["name_first"]
        return f"Hello {name} <a href='/logout'>Log out</a>"

    # Step 1: not logged in. Send them to identity and ask it to bring them back here.
    query = urlencode({"response_type": "code", "client_id": CLIENT_ID, "redirect_uri": RETURN_TO})
    return f"<a href='{IDENTITY}/oauth/authorize?{query}'>Connect with VATSIM</a>"


@app.route("/logout")
def logout():
    token = request.cookies.get(COOKIE)
    if token:
        requests.post(f"{IDENTITY}/oauth/revoke", data={"token": token})
    resp = make_response(redirect("/"))
    resp.delete_cookie(COOKIE)
    return resp
```

## Browser only

A static site has no server, so the page keeps the token in `localStorage` and calls identity directly. Identity's API allows cross-origin calls from `flyindycenter.com` and `localhost` origins.

```js
// main.js
import { createIdentityClient } from "@indy-center/identity";

const identity = createIdentityClient();
// Any script on the page can read localStorage; none can read an HttpOnly
// cookie. If your app has a server, keep the token in a cookie instead.
const KEY = "identity_token";

async function start() {
  // Steps 2 and 3: back from identity with a code? Trade it and keep the token in the browser.
  const login = await identity.completeLogin(location.href);
  if (login) {
    localStorage.setItem(KEY, login.token);
    history.replaceState(null, "", login.redirectTo); // this page without code and state
  }

  // Step 4
  const token = localStorage.getItem(KEY);
  const session = token ? await identity.getSessionContext(token) : null;

  if (session) {
    document.body.textContent = `Hello ${session.user.vatsimData.personal.name_first}`;
  } else {
    // Step 1
    document.body.innerHTML = `<a href="${identity.loginUrl(location.href)}">Connect with VATSIM</a>`;
  }
}

async function logOut() {
  const token = localStorage.getItem(KEY);
  if (token) await identity.logout(token);
  localStorage.removeItem(KEY);
  location.reload();
}

start();
```

## Logging out

There are two kinds of logout, and they do different things:

- **This app only.** Revoke the token with `identity.logout(token)` or `POST /oauth/revoke`, then delete it on your side. The user stays logged in to identity and to every other app, so the next click on "Connect with VATSIM" comes straight back without a VATSIM screen.
- **Every Indy Center app.** Send the browser to `identity.logoutUrl(returnUrl)`, which is `GET /logout?return_url=…` on identity. Identity revokes every session the user has, clears its own cookie, and redirects to `return_url`.

Link your "Log out" button to the first. Offer the second as "Log out everywhere" if the app needs it.

## HTTP endpoints

Identity uses standard OAuth 2.0 endpoints, so tools with OAuth support, such as Moodle or Wiki.js, can log in through identity too.

- **`GET /oauth/authorize`.** Query `response_type=code`, `client_id`, `redirect_uri`, and optional `state`. Redirects to `redirect_uri` with `code`, and `state` unchanged if you sent it. A `redirect_uri` outside the allowlist gets a `400`, never a redirect. `client_id` is any name for your app; identity treats it as a label.
- **`POST /oauth/token`.** Form body `grant_type=authorization_code`, `code`, `redirect_uri` (the same value sent to `/oauth/authorize`) and `client_id`. Returns `{ "access_token", "token_type": "Bearer", "expires_in" }`. The code works once and expires after 60 seconds.
- **`GET /oauth/userinfo`.** Header `Authorization: Bearer <token>`. Returns the session context. `401` means the token is no longer valid, so treat it as logged out.
- **`POST /oauth/revoke`.** Form body `token`. Always returns `200`, even for an unknown token.
- **`GET /logout?return_url=…`.** Global logout, described [above](#logging-out). The only identity route that takes `return_url`.

`/login/callback` is also on identity, but it's where VATSIM sends the browser back to identity. Apps never call it.

Identity accepts these values for `redirect_uri`:

| Accepted                                                               | Example                             |
| ---------------------------------------------------------------------- | ----------------------------------- |
| `https://flyindycenter.com` and its subdomains                         | `https://charts.flyindycenter.com/` |
| `http://localhost`, `http://127.0.0.1` and `http://[::1]`, on any port | `http://localhost:5173/`            |

Anything else, including a bare path like `/airports`, is rejected.

> **Why no client registration.** Every app that uses identity today lives on `flyindycenter.com` or runs on a developer's machine, so the redirect allowlist is the whole of identity's trust in an app; `client_id` isn't checked. Registered clients with secrets, and PKCE, get added when an app on a domain we don't own needs identity.

## Local development

Running an app on `localhost` changes nothing in the code above. The app sends the user to deployed identity with a `http://localhost:…` return address, and the user logs in with their real VATSIM account and gets their real roles. [Running identity](/development/running-identity/) is for people changing identity itself.
