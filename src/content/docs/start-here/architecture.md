---
title: Architecture
description: How Indy Center's services fit together — Workers, the identity service, the session cookie, and what still runs elsewhere.
sidebar:
  order: 2
---

Indy Center runs on Cloudflare Workers. One of them, `identity`, owns auth; `charts` and any new service ask it who the user is over a service binding. A VPS and a small k3s cluster run the rest.

## Workers first

Nearly everything runs on Cloudflare Workers. The exceptions:

- **VPS.** Self-hosted apps that need a long-running server — Wiki.js and Postiz — run on a separate VPS.
- **k3s cluster.** A small Kubernetes cluster still runs `controller-tools`, the older ATC tools app at `tools.flyindycenter.com`. It's the only cluster service the team maintains. Its Workers rewrite, `tools` at `app.controller.tools`, exists but is early.

## Identity

`identity` (`auth.flyindycenter.com`) is the centralized auth Worker. It owns the VATSIM Connect OAuth flow, sessions, users and roles. Other Workers don't reimplement any of that.

A consumer binds to identity over a Cloudflare [service binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/) and calls exactly one RPC method: `getSessionContext(token)`. It returns the user, their roles, session expiry, and their live controlling session and flight plan in one call — or `null`. Workers never call each other over HTTP; [RPC vs Queue](/patterns/rpc-vs-queue/) has the reasoning.

```
                 service binding
┌──────────┐  getSessionContext()  ┌──────────┐
│  charts  │ ────────── RPC ─────▶ │ identity │ → users, sessions, roles
└──────────┘                       └──────────┘ → VATSIM Connect (OAuth)
```

> **Why one method.** `IdentityRpc` in `identity/src/client/api.ts` is the versioned contract other repositories compile against. The `Identity` Worker class has more methods — `getUserById`, `addRole`, `invalidateSession` and others — callable at runtime but deliberately left out of the types. When a consumer needs one, it gets added to the interface in a minor version.

`charts` (`charts.flyindycenter.com`) is the reference consumer; [Auth](/patterns/auth/) walks through its wiring for anyone building a new one. `community-website` (`flyindycenter.com`) still runs its own older session system and hasn't migrated to identity yet.

## The session cookie

The session cookie is `fic_session`, set on `.flyindycenter.com`, so any subdomain can read it. Identity owns the whole cookie lifecycle through its own `/login` and `/logout` routes. Consumers [link to those routes](/patterns/auth/#login-and-logout-links) and pass the cookie's value to `getSessionContext`; they never set or clear the cookie themselves.

## Types

Identity's types come from the `@indy-center/identity` package. It isn't published to a registry; consuming repositories resolve it by relative path to a sibling checkout at `../identity`. [Setup](/development/setup/#directory-layout) covers what that means for cloning.
