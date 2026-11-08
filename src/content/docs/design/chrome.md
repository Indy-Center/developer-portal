---
title: Chrome
description: What every Indy Center app shares around its content — header, menu of apps, user menu, footer and page title — and how links and the color scheme work between apps.
sidebar:
  order: 4
---

The chrome is what every app shares around its own content: the header, the menu of apps, the user menu, the footer and the page title. It's a default — an app may differ for a written reason — but a member moving between apps should never have to relearn it.

## Checklist

- [ ] Put one [`Header`](https://centerline.flyindycenter.com/header) before `<main id="main">` and one [`Footer`](https://centerline.flyindycenter.com/footer) after it, both in the root layout and outside `<main>`.
- [ ] Pass the `Header` the app from `INDY_CENTER_APPS`, the app's own pages as `nav`, the current path, the signed-in member, and identity's sign-in and sign-out addresses. On the hub, leave out `app`.
- [ ] Don't add `SkipLink`, `AppNav`, `AppsMenu` or `UserMenu` yourself; the header places them.
- [ ] Keep the app's navigation to top-level links and one level of groups. Its admin, and anything only some members see, goes there, not in the user menu.
- [ ] Title every page page first: `<Page> | <App> | Indy Center`, or `<Page> | Indy Center` on the hub.
- [ ] Link between apps in the same tab. Only an editing tool, such as Payload, opens links out in a new tab.
- [ ] Run the color-scheme hook with `fallback: "dark"` and don't set `data-theme` on `<html>` yourself.
- [ ] Don't color or resize any chrome component. `class` is for layout only.

## The header

The [`Header`](https://centerline.flyindycenter.com/header) is 64px tall, sticks to the top, and is dark in both schemes. Left to right it holds:

- **Skip to content.** [`SkipLink`](https://centerline.flyindycenter.com/skip-link), hidden until it has keyboard focus.
- **The mark or logo, to the hub.** The mark on phones, the full logo from 640px. In an app, a divider and then the app's name, to the app's home. On the hub, the logo alone.
- **The app's navigation.** [`AppNav`](https://centerline.flyindycenter.com/app-nav), from 1024px. The logo and name take a fixed 16rem, so the navigation starts in the same place in every app. Below 1024px it moves into a Menu button's panel.
- **Apps.** [`AppsMenu`](https://centerline.flyindycenter.com/apps-menu): every Indy Center app, the current one marked.
- **The user menu, or Sign in.** [`UserMenu`](https://centerline.flyindycenter.com/user-menu), a round initials button, or "Sign in with VATSIM" when nobody is signed in.

Give the page `scroll-padding-top: 4rem` (`scroll-pt-16` on `<html>`), so a link to an `#id` scrolls below the header rather than under it.

## Navigation

Every app makes two ways out plain: the logo to the hub, and the app's name to the app's home. Its own navigation stays shallow — top-level links and groups of links, never a group inside a group — so nobody gets lost in nested menus. Leave out links to other apps (the Apps menu has them) and a "Home" that leads to the hub.

The current page, and a group holding it, sit on a soft fill. `current={page.url.pathname}` is all it takes.

## The user menu

Every app's user menu holds the same things, so a member's account always looks the same: their name, CID and ATC and pilot ratings; My profile and Settings, on the hub; their time zone and color scheme; and Sign out. An app adds nothing to it. Its own items, such as its admin, go in its navigation.

## The footer

The [`Footer`](https://centerline.flyindycenter.com/footer) is a small map of links beside the logo, the [disclaimer](https://brand.flyindycenter.com/guide/voice.html#the-disclaimer) and the copyright, dark in both schemes. The disclaimer and logo are fixed; the app passes the links as `columns`, two or three short columns with a heading over each.

Which links every app shows isn't settled: it waits on the privacy, accessibility and community pages, which aren't written yet. Until then, link what the app has — its other apps, contact, Discord — and leave out pages that don't exist rather than linking to nothing.

## Page titles

Each page sets its own `<title>`, page name first, so members can tell their tabs apart:

| Where             | Title                            | Example                               |
| ----------------- | -------------------------------- | ------------------------------------- |
| A page in an app  | `<Page> \| <App> \| Indy Center` | `Sessions \| Training \| Indy Center` |
| An app's home     | `<App> \| Indy Center`           | `Training \| Indy Center`             |
| A page on the hub | `<Page> \| Indy Center`          | `Events \| Indy Center`               |
| The hub's home    | `Indy Center`                    | `Indy Center`                         |

```svelte
<svelte:head><title>Sessions | Training | Indy Center</title></svelte:head>
```

## Links between apps

Links from one app to another open in the same tab, so Back works the way members expect. Don't add `target` to the Apps menu or any other link between apps.

The exception is an editing tool. Payload opens links out in a new tab, so an editor doesn't lose unsaved work. Any other link that opens a new tab says so in its text.

## Color scheme

A member's light or dark choice follows them from app to app: it's saved in a cookie shared across `flyindycenter.com`, which every app's server hook reads. The order is the member's choice, then their device, then light, and members who had an account before light arrived start in dark (brand decision 0002). [Tokens](/design/tokens/#light-and-dark) explains why apps run `fallback: "dark"` for now.

The choice is made in the user menu and on the hub's Settings page, with [`ColorSchemeSetting`](https://centerline.flyindycenter.com/color-scheme-setting); the [color scheme](https://centerline.flyindycenter.com/color-scheme) page has the hook and the script tag.

## Touch sizes

Every chrome control and menu row is at least 44px tall and wide, which the components handle. That's above the 24px WCAG 2.2 AA asks for (see [Accessibility](/design/accessibility/#touch-sizes)), so members on phones don't mis-tap.
