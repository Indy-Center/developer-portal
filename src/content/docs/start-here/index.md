---
title: Start here
description: What Indy Center tech is, who maintains it, and which page to read next.
sidebar:
  order: 1
---

Indy Center is a VATSIM air route traffic control center — a volunteer community running air traffic control for flight simulation. The tech side is a small volunteer team, three or four people, maintaining the web services that controllers and pilots use: the community website, charts, the ATC tools, and the auth service behind them.

Every repository is public in the [`Indy-Center`](https://github.com/Indy-Center) GitHub organization, and outside contributions are welcome. CI enforces what matters; these docs explain how to fix what it flags.

Read these in order:

- [Architecture](/start-here/architecture/) — how the services fit together.
- [Access](/start-here/access/) — the three accounts, what each unblocks, and who grants them.
- [First contribution](/start-here/first-contribution/) — from a one-line doc fix to a code change.

After those, [Development](/development/setup/) gets a machine running the services locally, [Patterns](/patterns/auth/) shows how existing Workers are built so a new one can match them, and [Working agreements](/agreements/definition-of-done/) covers what a change needs before it merges.

[Projects](/projects/) lists every repository and whether it's still alive.
