---
title: Architecture
description: How Indy Center's services fit together — Workers, the identity service, sessions, and what still runs elsewhere.
sidebar:
  order: 2
---

Indy Center runs on Cloudflare Workers. One of them, `identity`, owns auth; `charts` and any new service ask it who the user is over a service binding. A VPS and a small k3s cluster run the rest.

## Workers first

Nearly everything runs on Cloudflare Workers. The exceptions:

- **Vanderbilt VPS.** Apps that need a long-running server or are someone else's software in a container — Wiki.js today. One Traefik, deployed from `docker-infrastructure`, serves a Let's Encrypt wildcard for `*.flyindycenter.com` and routes to each app; every app deploys itself from its own repository over SSH. [Deploying to the VPS](/patterns/vps-apps/) covers adding one.
- **k3s cluster.** Being phased out. It still runs `controller-tools`, the older ATC tools app at `tools.flyindycenter.com`, and nothing new goes on it. It goes away once `controller-tools`' Workers rewrite, `tools` at `app.controller.tools`, replaces it; that rewrite exists but is early.

## Identity

`identity` (`auth.flyindycenter.com`) is the centralized auth Worker. It owns the VATSIM Connect OAuth flow, sessions, users and roles. Other Workers don't reimplement any of that.

A consumer binds to identity over a Cloudflare [service binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/) and calls `getSessionContext(token)` on each request. It returns the user, their roles, session expiry, and their live controlling session and flight plan in one call — or `null`. Workers never call each other over HTTP; [RPC vs Queue](/patterns/rpc-vs-queue/) has the reasoning.

```
                 service binding
┌──────────┐  getSessionContext()  ┌──────────┐
│  charts  │ ────────── RPC ─────▶ │ identity │ → users, sessions, roles
└──────────┘                       └──────────┘ → VATSIM Connect (OAuth)
```

> **Why a small contract.** `IdentityRpc` in `identity/src/client/api.ts` is the versioned contract other repositories compile against. Identity 1.1.0 trims the `Identity` Worker class to exactly that contract: `getSessionContext`, `logout` and `exchangeCode`. A consumer that needs a management operation gets it added then, with its authorization decided then.

`charts` (`charts.flyindycenter.com`) is the reference consumer; [Auth](/patterns/auth/) walks through its wiring for anyone building a new one. `community-website` (`flyindycenter.com`) still runs its own older session system and hasn't migrated to identity yet.

## Sessions

From identity 1.1.0, login is the OAuth authorization-code flow. Identity keeps a cookie of its own on `auth.flyindycenter.com` so it remembers who the user is. Each app trades a short-lived code for its own session token and stores it on its own origin; no cookie is shared across subdomains. The same flow works from `localhost`, and any HTTP client can use it, not only Workers. [Login flow](/patterns/auth-flow/) walks through it and [Auth](/patterns/auth/) has the code.

## Types

Identity's types and client come from the `@indy-center/identity` package, built from identity's `src/client/`. Today consuming repositories resolve it by relative path to a sibling checkout at `../identity`; [Setup](/development/setup/#directory-layout) covers what that means for cloning. From 1.1.0 it's published to npm from identity's CI and installed from the registry.
