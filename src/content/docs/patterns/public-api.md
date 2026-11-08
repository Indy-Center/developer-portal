---
title: CMS public API
description: Reading ZID's positions and Indy's credentials from the CMS at cms.flyindycenter.com, with no token — the routes, their fields, the caching and error rules, and how v1 changes.
sidebar:
  order: 8
---

The CMS (`cms.flyindycenter.com`, the `payload` repo) serves a few lists to anyone, with no sign-in and no token: ZID's positions and the credentials Indy issues. This page is for anyone building an app or service that needs them. Everything else the CMS holds stays behind a sign-in or an app's own token.

- `GET https://cms.flyindycenter.com/api/public/v1/positions`
- `GET https://cms.flyindycenter.com/api/public/v1/credentials`

Each answers a JSON list. Read them from a server, not from browser JavaScript; see [CORS](#cors) below.

## The rules

Both routes answer the same way:

- **No token.** No `Authorization` header, no cookie.
- **GET only.** Any other method gets a 404.
- **Cached five minutes.** A good answer carries `Cache-Control: public, max-age=300`. The CMS has no ETags yet, so cache for five minutes on your side rather than polling.
- **A 500 is never stale.** When the CMS can't build a list it answers 500 with `{ "errors": [{ "message": "Could not build positions." }] }` and `Cache-Control: no-store`. It never serves an old copy instead, so keep your own last good copy and fall back to it.
- **Order isn't part of the contract.** Positions come by callsign and credentials up the ladder today; sort them yourself if you need an order.

```ts
// Server-side only: the CMS sends no Access-Control-Allow-Origin.
let lastGood: Position[] = [];

export async function positions(): Promise<Position[]> {
  const res = await fetch(
    "https://cms.flyindycenter.com/api/public/v1/positions",
  );
  // A 500 means the CMS couldn't build the list; it won't send an old one,
  // so serve the last copy we had.
  if (!res.ok) return lastGood;
  lastGood = await res.json();
  return lastGood;
}
```

### CORS

Browsers on another origin can't read these routes. Responses carry the `Vary`, `Access-Control-Allow-Headers` and `Access-Control-Allow-Methods` headers that Next.js and Payload add to every response, but no `Access-Control-Allow-Origin`, so a cross-origin `fetch` fails in the browser. That's on purpose: an app that fetches from the browser by mistake fails loudly in development instead of quietly loading the CMS from every visitor's page.

> CORS only governs browser JavaScript on another origin. It isn't access control — `curl` reads these routes either way — so turning it on would buy nothing but browser traffic. An app that needs a browser fetch should say so; it's one of the things that would reopen the CMS's caching.

## Positions

Every ZID position, as the CMS copies it from vNAS Data Admin, with Indy's own facts added. Retired positions are included and flagged, because records elsewhere may still name them.

| Field                 | Type                    | What it is                                                                                                                                  |
| --------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                  | string                  | vNAS's id, the same its live controller feed uses.                                                                                          |
| `callsign`            | string                  | Such as `IND_83_CTR`.                                                                                                                       |
| `name`                | string                  | Such as `Falmouth 83`.                                                                                                                      |
| `shortName`           | string or null          | As controllers say it, such as `FLM 83`: vNAS's where it has one, else Indy's. Null where there's neither.                                  |
| `radioName`           | string                  | Such as `Indy Center`.                                                                                                                      |
| `frequency`           | number                  | In Hz: `128225000` is 128.225 MHz.                                                                                                          |
| `facility`            | object                  | `{ id, name, parent }`. `parent` is the facility it sits under in vNAS's tree — a satellite tower's is its TRACON — and null in ZID itself. |
| `starred`             | boolean                 | One of its facility's main positions.                                                                                                       |
| `requiredCredentials` | `{ anyOf: string[] }[]` | Credential codes a controller must hold to work it. See below.                                                                              |
| `retired`             | boolean                 | vNAS no longer lists it.                                                                                                                    |

`requiredCredentials` is a list of rows. Every row must be met, and a row is met by holding any one of its codes. A certification is also met by any certification ranked higher (an `A-LC` holder meets `S-GC` and `A-GC`); an endorsement counts only when named. An empty list means no credential is needed. Your app applies this — the CMS checks nothing against it, and doesn't serve who holds what.

Group by `facility.parent` to get vNAS's facility tree without copying it. Trimmed from the live list:

```json
[
  {
    "id": "01GXNYD3HS86PYG825DA2T8RTR",
    "callsign": "AID_GND",
    "name": "Ground Control",
    "shortName": "AID GC",
    "radioName": "Anderson Ground",
    "frequency": 121600000,
    "facility": {
      "id": "AID",
      "name": "Anderson Muni ATCT",
      "parent": { "id": "IND", "name": "Indianapolis ATCT/TRACON" }
    },
    "starred": true,
    "requiredCredentials": [{ "anyOf": ["A-GC"] }],
    "retired": false
  }
]
```

## Credentials

The certifications and endorsements Indy issues, keyed on `code`. Retired ones are included and flagged. It describes the credentials, never who holds them.

| Field         | Type           | What it is                                                                          |
| ------------- | -------------- | ----------------------------------------------------------------------------------- |
| `code`        | string         | Such as `S-GC` or `T2-CTR`. What a position's `requiredCredentials` name.           |
| `name`        | string         | The credential's name, without the code.                                            |
| `kind`        | string         | `certification` (ranked on the ladder) or `endorsement` (counts only when named).   |
| `rank`        | number or null | A certification's place on the ladder, higher above lower. Null for an endorsement. |
| `description` | string         | What it covers; an empty string when none is written.                               |
| `retired`     | boolean        | No longer issued, though records may still name it.                                 |

Trimmed from the live list:

```json
[
  {
    "code": "A-GC",
    "name": "Advanced Ground Control",
    "kind": "certification",
    "rank": 2,
    "description": "Ground control at Indianapolis and our busier terminal fields.",
    "retired": false
  }
]
```

## Versioning

v1 grows without breaking you, as long as you ignore fields you don't know: adding a field never needs a new version. Anything else does — removing, renaming or retyping a field, changing its units or meaning, or changing which rows are included. That comes as `/api/public/v2/…`, and v1 keeps being served until every app reading it has moved.

## Being counted as a reader

The CMS only knows who reads v1 from its own README. When your app starts reading a route, open a pull request on `payload` adding it to that route's line under **HTTP surface** in the README (both say "No readers yet" today). v1 isn't retired until every app listed there has moved off it.

Considered, not chosen: opening Payload's own `/api/positions` to the public. It publishes the storage fields we expect to rename, and Payload's query, depth and GraphQL with them; a typed route under `/api/public/v1/` can stay put while the storage changes.

## Out of scope

Not public, and not coming here: who holds which credential, the course list, partners, the courseware catalogue and task tree, lesson plans, scenarios and teacher resources. Each is read by the app that owns it with its own token.
