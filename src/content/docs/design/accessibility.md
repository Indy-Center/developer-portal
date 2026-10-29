---
title: Accessibility
description: The WCAG 2.2 AA rule and what it means in an Indy Center app — headings in order, landmarks, buttons and links, labelled fields, visible focus and touch sizes.
sidebar:
  order: 5
---

Every Indy Center app meets WCAG 2.2 AA, in both color schemes and at every width. It's a rule, like the brand's colors and type, and it includes correct element and heading hierarchy. The components meet it for what they draw; this page is what the app around them has to do.

## Checklist

- [ ] Give every page one `h1` and headings in order, with no level skipped. Use [`Heading`](https://centerline.flyindycenter.com/heading), and set its `level` from the outline, never from the size you want.
- [ ] Keep the landmarks: `Header` before `<main id="main">`, `Footer` after it, both outside `<main>`. One `<main>` per page.
- [ ] Use a button for an action on the page and a link for going somewhere: [`Button`](https://centerline.flyindycenter.com/button) and [`Link`](https://centerline.flyindycenter.com/link). No clickable `<div>` or `<span>`.
- [ ] Label every form control: [`Field`](https://centerline.flyindycenter.com/field) for one control, [`Fieldset`](https://centerline.flyindycenter.com/fieldset) for a group of radios or checkboxes. Help in `hint`, not the placeholder.
- [ ] Never remove a focus outline. A control of your own shows the `ring` outline on keyboard focus.
- [ ] Make every control at least 24px, and chrome controls and menu rows 44px.
- [ ] Name every icon-only button or link with `aria-label`; an icon beside its own words takes no label.
- [ ] Write link text that says where it goes, and say so when a link opens a new tab or downloads a file.
- [ ] Check the page by keyboard alone: everything reachable with Tab, in a sensible order, and nothing that traps focus.

## Headings

Screen-reader users move through a page by its headings, so the outline has to be real. `Heading` renders a true `<h1>` to `<h6>` at the `level` you give it; when that level's size is wrong for the spot, set `look`, which changes the size and never the element. A styled `<span>` or `<div>` that looks like a heading isn't one.

A page's title belongs in [`PageHeader`](https://centerline.flyindycenter.com/page-header), which renders its `h1`; a panel's title in [`Panel`](https://centerline.flyindycenter.com/panel). Both use `Heading` inside, so don't put another `h1` beside them.

```svelte
<Heading level={1}>Events</Heading>
<Heading level={2}>This week</Heading>
<!-- An h2 in the outline that looks like a small label on screen. -->
<Heading level={2} look="label">Facilities</Heading>
```

## Landmarks

The chrome gives each page its landmarks: the header is the `banner`, the footer the `contentinfo`, and each `<nav>` is named ("Main", "Footer"). The app supplies `<main id="main">` between them, which the header's skip link moves focus to. A header or footer placed inside `<main>`, `<article>` or `<section>` stops being a landmark, so keep them in the root layout.

The root `<html>` carries `lang="en"`.

## Buttons and links

A button does something on this page — save, open, delete — and a link goes to another page. Screen readers announce them differently and keyboards press them differently (Space presses a button, not a link), so the element has to match what it does. `Button` takes `href` for the case where something goes to another page but must look like a button ("New event"); it renders an `<a>` then.

Menus in the chrome are disclosures — a button with `aria-expanded` and the panel it shows — not ARIA menus. They close on Escape and put focus back on their button.

## Forms

`Field` writes the `<label>`, the hint and the error, and wires them to the control with `id`, `for` and `aria-describedby`; don't write those yourself. Keep the label visible and short ("Callsign"), with `required` rather than a `*`. An error says how to fix the value. After a failed submit, show a summary or move focus to the first invalid control.

## Focus

Every control shows a visible outline in the `ring` role when it's reached by keyboard. The components draw it; `base.css` sets none, so a control of your own adds it:

```svelte
<!-- focus-visible, so a mouse click shows no outline but Tab does. -->
<button class="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">…</button>
```

The sticky header covers the top 64px, so the page needs `scroll-padding-top: 4rem` to keep a focused control from scrolling under it ([Chrome](/design/chrome/#the-header)).

## Touch sizes

WCAG 2.2 AA asks for targets of at least 24px (2.5.8). Indy Centerline's default is 44px for every chrome control and menu row, and the components' buttons and rows meet it. A link inside a sentence is exempt from both.

## Color and contrast

Text meets 4.5:1 and large text and control edges 3:1, in both schemes. The roles are checked for it, which is one more reason to [use roles](/design/tokens/) and not raw colors; the brand guide's [Contrast](https://brand.flyindycenter.com/guide/color-and-type.html#contrast) notes give the one exception. Never show a state by color alone: pair it with text, an icon or a shape.
