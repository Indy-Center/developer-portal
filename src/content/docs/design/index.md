---
title: Indy Centerline
description: Indy Center's design system — which guidance is a rule and which a default, who to ask, and where the rules, components and values each live.
sidebar:
  label: Overview
  order: 1
---

Indy Centerline is Indy Center's design system: the tokens, chrome and patterns that make every member app feel like one experience, and the guidance for using them. This section is for developers building or changing an Indy Center app, and for the agents working with them.

## Checklist

- [ ] Follow the rules without exception: the marks, color, type, and WCAG 2.2 AA, including real element and heading hierarchy. A change to one goes through the brand owner.
- [ ] Follow the defaults — the chrome and the patterns — unless the app has a reason not to. Write the reason down where the next developer will find it (see [Recording a difference](#recording-a-difference)).
- [ ] Use the components from `@indy-center/centerline-svelte` rather than rebuilding them. [Install](/design/install/) sets an app up.
- [ ] Take values from the brand guide and component details from the reference site; don't copy either into the app's own docs.
- [ ] When the guidance is silent, do what the reference app, the community site, does.
- [ ] Use MDI icons (`@mdi/js`).

## Where things live

| What                                                       | Where                                                                       |
| ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| The rules for apps: install, tokens, chrome, accessibility | This section                                                                |
| Each component: its checklist, props and a live demo       | [centerline.flyindycenter.com](https://centerline.flyindycenter.com)        |
| Color and type values, the marks and logo files            | [brand.flyindycenter.com](https://brand.flyindycenter.com)                  |
| The code                                                   | [`Indy-Center/design-system`](https://github.com/Indy-Center/design-system) |

Each component's doc also ships in the package, beside its code, as `node_modules/@indy-center/centerline-svelte/dist/<Component>/<Component>.md`. An agent working in an app can read it there without a fetch.

> **Why two sites.** The component reference is built from the design-system repo, so a component and its doc change in the same pull request and go live together. This site holds only what stays true across releases.

## Rules and defaults

A **rule** isn't changed without the brand owner's approval. The marks, color and type are rules, and so is all of WCAG 2.2 AA, including correct element and heading hierarchy. The brand guide sets the brand rules; [Accessibility](/design/accessibility/) sets out what AA means here.

A **default** is guidance an app follows unless it has a reason not to, written down. The [chrome](/design/chrome/) and the patterns the components carry are defaults. The Tech Team Manager is consulted on them.

The line falls there because the brand has to look the same everywhere and an inaccessible app shuts members out, but an app with its own job sometimes needs its own layout.

### Recording a difference

Write the reason where the next developer will meet it:

- **At the spot.** A comment beside the code that differs, saying what the default is and why this app does otherwise.
- **For the whole app.** A line in the app's README, under a "Design" heading, for a difference that runs through the app, such as a session tool's own layout.

A difference from a rule isn't recorded; it's asked for first.

## Who to ask

- **Brand: the brand owner.** The marks, color and type, and any exception to them. That's the ATM, at [atm@flyindycenter.com](mailto:atm@flyindycenter.com).
- **Chrome and patterns: the Tech Team Manager.** How apps look and behave, and the code behind it. The title as [/staff](https://flyindycenter.com/staff) shows it (WM).

## Apps that go their own way

- **Forked apps.** scheddy is a fork of ZTL's scheddy and merges from upstream. The guidance applies as far as whoever works on it chooses to take it, weighed against the cost of those merges. scheddy keeps its Lucide icons.
- **Session tools.** Charts is used continuously through a flying or controlling session, alongside a pilot or controller client. It may keep its own flow and feel; the brand's rules and accessibility still apply.
- **Apps without Svelte.** Payload's admin takes the tokens alone, through its theme hooks. See [Install](/design/install/#apps-without-svelte).

## Out of scope

This section doesn't cover component APIs (the reference site has them), the tools site at app.controller.tools (its own brand, left to the tools team), or the developer portal's own look.
