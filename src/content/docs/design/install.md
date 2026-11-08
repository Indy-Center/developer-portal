---
title: Install
description: Adding @indy-center/centerline-tokens and @indy-center/centerline-svelte to a SvelteKit app, and the tokens alone to an app without Svelte, such as Payload.
sidebar:
  order: 2
---

Indy Centerline ships as two npm packages: `@indy-center/centerline-tokens`, the colors and fonts as CSS custom properties, a Tailwind v4 theme, Sass and JSON; and `@indy-center/centerline-svelte`, the chrome and patterns as Svelte 5 components on those tokens. A SvelteKit app takes both; any other app takes the tokens alone.

## Checklist

- [ ] The app has Svelte 5 and Tailwind v4 already. Install both packages.
- [ ] Import the four token files into the app's stylesheet, in order, and add the `@source` line for the components.
- [ ] Add the color-scheme hook to `src/hooks.server.ts`, its script tag to `src/app.html`, and `setColorScheme` to the root layout, all with `fallback: "dark"`.
- [ ] Put `Header` and `Footer` in the root layout, around `<main id="main">`. [Chrome](/design/chrome/) says what to pass them.
- [ ] Follow each package's README for the details below; they're the source and this page only points at them.
- [ ] An app without Svelte imports `tokens.css` (and `base.css` and `fonts.css` if it wants them) and nothing else.

## SvelteKit apps

```bash
npm install @indy-center/centerline-svelte @indy-center/centerline-tokens
```

The app's stylesheet imports the tokens after Tailwind, then tells Tailwind to read the components' classes:

```css
@import "tailwindcss";
@import "@indy-center/centerline-tokens/tokens.css";
@import "@indy-center/centerline-tokens/theme.css";
@import "@indy-center/centerline-tokens/base.css";
@import "@indy-center/centerline-tokens/fonts.css";
/* Relative to this stylesheet. Tailwind skips node_modules unless told,
   and without this line the components render unstyled. */
@source "../node_modules/@indy-center/centerline-svelte";
```

Then the color scheme, which every app serves the same way:

```ts
// src/hooks.server.ts
import { colorSchemeHandle } from "@indy-center/centerline-svelte/hooks";

// "dark" until identity stores the choice: nobody's app changes under them
// unless they pick light.
export const handle = colorSchemeHandle({ fallback: "dark" });
```

The root layout calls `setColorScheme({ fallback: "dark" })` with the same fallback, and `src/app.html` carries the hook's script tag. The [color scheme reference](https://centerline.flyindycenter.com/color-scheme) has both, and [Tokens](/design/tokens/#light-and-dark) explains the order.

The packages' READMEs cover the rest: `Prose` for CMS rich text (it needs `@tailwindcss/typography`), the aviation helpers, and the positions `Position` and `Frequency` look up.

- [`@indy-center/centerline-svelte` README](https://www.npmjs.com/package/@indy-center/centerline-svelte)
- [`@indy-center/centerline-tokens` README](https://www.npmjs.com/package/@indy-center/centerline-tokens)

Each component's page on [centerline.flyindycenter.com](https://centerline.flyindycenter.com) says what to import and pass. Its `.md` is also in the package, at `node_modules/@indy-center/centerline-svelte/dist/<Component>/<Component>.md`.

## Apps without Svelte

The tokens work anywhere CSS does. `tokens.css` alone gives every brand color, role and font stack as a custom property (`--color-card`, `--font-heading`); `base.css` after it sets page defaults from them; `fonts.css` loads Source Sans 3, the heading font.

- **Payload.** Its admin's SCSS uses `_tokens.scss`, which gives each token as its `tokens.css` variable, so load `tokens.css` as well. The tokens README has the `@use` line.
- **Canvas and other code that can't read custom properties.** `tokens.json` holds each scheme's resolved values.

> **Why not copy the hex values.** The token files are the source of truth for the brand guide's color tables. A value pasted into an app doesn't follow a change, and doesn't switch between light and dark.
