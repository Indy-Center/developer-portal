# Contributing

This repository is the source for [tech.flyindycenter.com](https://tech.flyindycenter.com). Small fixes don't need a clone: every page has an **Edit page** link that opens its source on GitHub.

## Running the site

```bash
npm install
npm run dev   # prints the local URL
```

## Checks

CI runs these on every pull request, in this order, and each one runs the same way locally:

```bash
npm run format:check   # npm run format rewrites whatever it flags
npm run check          # astro check
npm run build
npm test               # vitest, currently the project registry in src/data/
```

A pull request needs green checks and one approval to merge. Merging to `main` deploys.

## Where a page belongs

- **`src/content/docs/start-here/`.** Orientation for someone new: what Indy Center tech is, how it fits together, access, and a first contribution.
- **`src/data/projects.ts`.** The projects registry. The Projects page renders from it; edit the data, not `projects/index.mdx`.
- **`src/content/docs/development/`.** Getting a machine running the services locally.
- **`src/content/docs/patterns/`.** How to build something the way existing Workers are built, taken from their real code.
- **`src/content/docs/agreements/`.** What the team has agreed a change needs.

## Writing

[`.claude/skills/docs-voice/SKILL.md`](.claude/skills/docs-voice/SKILL.md) is the writing standard, derived from the org's existing technical writing. Read it before writing a page; its checklist is what review looks for.

Commit message style, branch names, and merge strategy aren't prescribed. [Branching](https://tech.flyindycenter.com/agreements/branching/) has the reasoning.
