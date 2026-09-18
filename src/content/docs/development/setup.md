---
title: Setup
description: What a machine needs before any Indy Center project will run locally — Node 22, per-project Wrangler, and a side-by-side checkout.
sidebar:
  order: 1
---

Before any Indy Center project runs locally, a machine needs Node 22 and a sibling checkout of `identity`. That's the whole toolchain; everything else installs per project with `npm install`.

## Node and Wrangler

CI runs Node 22 and no repository pins a version, so use 22. Wrangler comes with each project as a devDependency; run it with `npx wrangler` from inside the project.

```bash
node --version   # v22.x
```

## Directory layout

Check projects out side by side under one parent directory, with `identity` alongside them:

```
indy-center/
├── identity/
├── charts/
├── community-website/
└── discord-bot/
```

Clone only what you're working on, plus `identity`.

> **Why `identity` has to be a sibling.** `@indy-center/identity` isn't published to a registry. `charts`' lockfile resolves it by relative path to `../identity`, so `charts` won't install or build without that checkout beside it.

The package's types live in identity's gitignored `dist/`, and nothing builds them on install. Build them once, and again after pulling identity changes that touch `src/client/`:

```bash
cd identity && npm install && npm run build:lib
```

With that built, [Running identity](/development/running-identity/) brings identity up locally.

## Wrangler login

Local development doesn't need it. You need `npx wrangler login` only for work against the real IndyCenter account; [Access](/start-here/access/) covers what that includes and how to get added.
