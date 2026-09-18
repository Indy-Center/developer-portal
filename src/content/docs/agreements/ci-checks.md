---
title: CI checks
description: The three checks every Indy Center repository is expected to run on pull requests — formatting, types, tests — and how to fix each when it fails.
sidebar:
  order: 4
---

Every repository is expected to run three checks on pull requests: formatting, types, and tests. Each is an npm script, so what CI runs is exactly what you can run locally.

| Check      | Script                                                                        | Runs                                          |
| ---------- | ----------------------------------------------------------------------------- | --------------------------------------------- |
| Formatting | `npm run format:check`                                                        | `prettier --check`                            |
| Types      | `npm run typecheck` in a plain Worker; `npm run check` in SvelteKit and Astro | `tsc --noEmit`, `svelte-check`, `astro check` |
| Tests      | `npm test`                                                                    | `vitest run`                                  |

Some repositories name the formatting check `lint` rather than `format:check` — same `prettier --check`, different name. New repositories should use `format:check`.

## Fixing a failure

**Formatting.** Run `npm run format` to let Prettier rewrite the files, then commit the result.

**Types.** Run the same script CI ran — `npm run typecheck` or `npm run check` — and fix what it reports. In a SvelteKit project, `npm run check:watch` re-checks as you edit.

**Tests.** Reproduce locally, fix, and re-run:

```bash
npm run test:watch   # re-runs on save, where the repository has it
npm test             # the single run CI does
```

## Running on pull requests

The checks belong on the pull request, so a failure shows up before merge rather than after. This repository's [`.github/workflows/ci.yml`](https://github.com/Indy-Center/developer-portal/blob/main/.github/workflows/ci.yml) is the shape to copy; [CI shape](/patterns/ci-shape/) covers the triggers, the build step, and gating deploy on checks.
