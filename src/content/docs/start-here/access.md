---
title: Access
description: The three accounts an Indy Center contributor may need — Cloudflare, GitHub and Jira — and what each one unblocks.
sidebar:
  order: 3
---

A contributor may need three accounts: Cloudflare, GitHub and Jira. A doc fix needs none of them. A code change needs GitHub, and only for a fork. Cloudflare matters only when you touch real bindings, production D1 or a manual deploy. Jira is for tracking work, not for opening pull requests.

## Cloudflare

Needed for anything that talks to the real IndyCenter account — remote bindings, production D1, manual deploys. Local development doesn't need it: `wrangler dev` and `vite dev` run against local simulated bindings. A maintainer has to add you to the account first:

```
# IndyCenter account ID — `wrangler whoami` lists it once you're added
afd63515948c9b2188ce14ef1504b2c1
```

Nothing below works until that's done. Once it is, authenticate from inside any project:

```bash
# Wrangler is a devDependency in each project; there's no global install.
npx wrangler login    # opens a browser; pick the IndyCenter account
npx wrangler whoami   # confirm IndyCenter is the active account
```

The login is stored once and shared by every project on your machine. [Setup](/development/setup/) covers the rest of the local toolchain.

## GitHub

The org is [`Indy-Center`](https://github.com/Indy-Center), and every repository in it is public. If you can't push to a repository, fork it and open a pull request from the fork — that works for code and docs alike, and it's the normal path for outside contributors.

## Jira

The tech team tracks work in the `DEV` project on the org's Atlassian site. Ask a maintainer for an invite; [Jira](/agreements/jira/) covers how the team uses it.
