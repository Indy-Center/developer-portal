---
title: Tokens
description: Using color roles rather than raw colors, what each role group is for, how light and dark work, and where the values are.
sidebar:
  order: 3
---

The tokens are Indy Centerline's named values: three brand colors, eighteen color roles in light and dark, and three font stacks, from `@indy-center/centerline-tokens`. Colors and type are brand rules; the tokens are how an app follows them without copying a value.

## Checklist

- [ ] Color by role, never by raw value: `bg-card`, `text-foreground`, `border-border`, or `var(--color-card)` outside Tailwind. No hex, and no `slate-*`, `gray-*` or `sky-*` in new code.
- [ ] Pick the role for what the thing is, not for the color it happens to be: a link is `link`, an error `destructive`.
- [ ] Prefer a component that carries its own colors (`Heading`, `Text`, `Link`, `Button`) to coloring an element yourself.
- [ ] Let dark come from `data-theme="dark"`. Don't add a `.dark` class or a `prefers-color-scheme` block, and don't set `data-theme` on `<html>`: the color-scheme hook does.
- [ ] Use `font-heading` for headings and panel titles, the default sans for everything else, and `font-mono` for CIDs and ratings.
- [ ] Look values up in the brand guide's [Color and type](https://brand.flyindycenter.com/guide/color-and-type.html) page. A value that looks wrong is a question for the brand owner, not a change in the app.

## Roles, not colors

A role names what a color is for, such as the page background or muted text. Each role has a light and a dark value, so `bg-card` is right in both schemes and in the dark header on a light page. A raw `bg-slate-800` is close to dark `card`, but it's neither the brand's checked value nor scheme-aware.

Tailwind's own colors stay available beside the roles, so existing apps can move over slowly. Nothing stops them at build time; code review should flag them.

| Group   | Roles                                                              | For                                                                             |
| ------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Surface | `background`, `card`, `muted`, `border`, `input`                   | The page, cards and panels, raised areas and input fills, the lines around them |
| Text    | `foreground`, `foreground-soft`, `muted-foreground`, `placeholder` | Headings, body text, captions and fine print, placeholders                      |
| Action  | `primary`, `primary-hover`, `primary-foreground`, `link`, `ring`   | Main buttons and their text, links, focus outlines                              |
| Status  | `destructive`, `success`, `warning`, `info`                        | Errors and actions that delete, success, warnings, notices                      |

The brand colors — Night, Sky and White — are there too, for the marks and the few places the brand guide names them. Reach for a role first.

Each role is a Tailwind color, so every utility takes it: `bg-`, `text-`, `border-`, `ring-`, `fill-`. The brand guide's [Roles](https://brand.flyindycenter.com/guide/color-and-type.html#roles) table gives each value and the contrast notes, such as where `warning` text needs a card under it.

## Light and dark

Light values sit on `:root`; dark values apply on any element with `data-theme="dark"` and everything inside it. The header, footer and the home page's hero are dark in both schemes — the brand guide calls light "framed" — and their components set `data-theme="dark"` on themselves. Tailwind's `dark:` variant reads the same attribute, so a `dark:` class and a role never disagree.

Every app offers both schemes, chosen in this order: the member's own choice, then their device's setting, then light. Members who had an account before light arrived start in dark until they choose (brand decision 0002).

For now the choice is a cookie shared across `flyindycenter.com`, and apps run the hook with `fallback: "dark"`: with nothing chosen, the page is dark, as every app is today. When identity can store the choice, existing accounts get dark saved for them and apps move to `fallback: "device"`, which gives the full order. Until then the scheme control hides "Use my device's setting".

> **Why `data-theme` and not `.dark`.** The order needs three states on `<html>` — chose dark, chose light, chose nothing — and a class has only two. An attribute also works on a single element, which is how the dark header sits on a light page.

## Type

| Token            | Tailwind       | For                                                      |
| ---------------- | -------------- | -------------------------------------------------------- |
| `--font-heading` | `font-heading` | Headings, including panel and card titles: Source Sans 3 |
| `--font-sans`    | `font-sans`    | Everything else: the device's own sans-serif             |
| `--font-mono`    | `font-mono`    | CIDs and ratings, with tabular numbers                   |

`base.css` sets `h1`–`h6` in the heading font and the body in the sans, so plain elements are right without a class. Sizes are Tailwind's defaults; the brand guide's [Sizes](https://brand.flyindycenter.com/guide/color-and-type.html#sizes) table says which is for what, and `Heading` and `Text` apply them.
