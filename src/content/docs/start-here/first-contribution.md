---
title: First contribution
description: Two ways to make a first contribution to Indy Center — fix a doc from the browser, or change code — smallest first.
sidebar:
  order: 4
---

There are two ways to make a first contribution: fix a doc from the browser, or change code in a local clone. Both end in a pull request against `main`.

## Fix a doc

Every page on this site has an **Edit page** link at the bottom. It opens the page's source on GitHub; edit it in the browser and open a pull request. That's the whole workflow — no clone, no local setup, no org membership. GitHub forks the repository for you if you can't push to it.

## Change code

Clone the repository you want to change and `identity` side by side in the same parent directory:

```bash
mkdir indy-center && cd indy-center
git clone https://github.com/Indy-Center/identity.git
git clone https://github.com/Indy-Center/charts.git
# identity's types are built, not committed — build them once before its consumers
(cd identity && npm install && npm run build:lib)
cd charts && npm install
```

`charts` only builds with `identity` checked out beside it; [Setup](/development/setup/#directory-layout) explains why. [Running identity](/development/running-identity/) covers getting identity running locally.

From there:

1. Create a branch and make the change.
2. Open a pull request against `main`. Branch names and commit message style are up to you.
3. CI runs [the checks](/agreements/ci-checks/) where the repository has them; one approval is needed to merge.
4. Merge. Repositories with a deploy workflow deploy on merge to `main`.

Anything that touches the real Cloudflare account needs access first — see [Access](/start-here/access/). [Projects](/projects/) lists which repositories are active.
