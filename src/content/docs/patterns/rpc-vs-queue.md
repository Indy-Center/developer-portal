---
title: RPC vs Queue
description: How one Indy Center Worker talks to another — RPC over a service binding when the caller needs an answer, a Cloudflare Queue when the work only has to happen eventually, and never HTTP.
sidebar:
  order: 4
---

Workers talk to each other two ways: RPC over a service binding, which is synchronous and typed, and a Cloudflare Queue, which is asynchronous and retried.

No HTTP between Workers. No shared secrets. No CORS.

Who's waiting for the result decides it. If a person is, the call is RPC and it has to be fast. If nobody is, a Queue takes the work off the request path and brings retries with it — a message survives the consumer being mid-deploy, where an RPC call just throws.

## RPC

The one cross-Worker call in the org is `charts` calling `identity.getSessionContext(token)` on every request; [Auth](/patterns/auth/) has the wiring. Arguments and return values cross by structured clone, so `SessionContext.sessionExpiresAt` arrives as a real `Date`. Exceptions in the callee reject the caller's promise, so decide at each call site what an outage looks like; charts treats the request as logged out.

## Queues

No Worker uses a queue yet; `community-website`'s roster sync is a cron inside its own Worker. Document the first queue here from its real code.

## No HTTP between Workers

Service bindings aren't reachable from the internet, so there's nothing to authenticate. A Worker can call another only if its `wrangler.jsonc` declares the binding, and that's reviewed like any other change.

Considered, not chosen: an internal JSON route behind a shared secret header. The route is public whether you meant it or not, the secret has to be rotated in two Workers at once, browser callers need CORS on top, and the caller gets `unknown` back instead of a type.

The rule is for Worker-to-Worker calls. Routes for browsers or outside services — identity's `/oauth` endpoints, discord-bot's webhooks — are HTTP because their callers aren't Workers.
