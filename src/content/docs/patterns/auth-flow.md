---
title: Login flow
description: How identity logs a user in through VATSIM once and hands each Indy Center app its own session, in production and on localhost.
sidebar:
  order: 2
---

:::note[Coming soon]
Identity is moving to the OAuth-based login described here, and charts will be the first app on it. The endpoints are landing on identity's `feat/http-transport` branch and aren't deployed yet.
:::

Identity logs people in with VATSIM once, remembers them, and hands each app a short-lived code. The app trades the code for its own session. It works the same on `charts.flyindycenter.com` and on a laptop. This page explains the flow; [Auth](/patterns/auth/) has the code to add it to an app.

## First login

The app sends the user to identity. Identity sends them to VATSIM, gets the answer, and sends them back to the app with a code. The app never talks to VATSIM.

<figure style="overflow-x: auto; margin: 1rem 0">
<svg viewBox="0 0 720 690" role="img" aria-label="Sequence: the browser opens the app, follows the login link to identity, identity redirects to VATSIM, VATSIM redirects back to identity, identity records the user, remembers them, and redirects to the app with a code; the app trades the code for a session token, keeps the token, and asks identity who the user is." width="100%" style="display: block; min-width: 520px; height: auto; font-family: var(--sl-font)"><defs><marker id="ah1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker><marker id="ahk1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill: var(--sl-color-accent)"/></marker></defs>
        <g>
          <rect style="fill: var(--sl-color-bg)" stroke="currentColor" stroke-width="1.2" x="40" y="16" width="100" height="40" rx="4"/>
          <text font-size="13" font-weight="600" fill="currentColor" x="90" y="34" text-anchor="middle">Browser</text>
          <text font-size="11" fill="currentColor" fill-opacity="0.7" x="90" y="48" text-anchor="middle">the user</text>
          <rect style="fill: var(--sl-color-bg)" stroke="currentColor" stroke-width="1.2" x="220" y="16" width="100" height="40" rx="4"/>
          <text font-size="13" font-weight="600" fill="currentColor" x="270" y="34" text-anchor="middle">App</text>
          <text font-size="11" fill="currentColor" fill-opacity="0.7" x="270" y="48" text-anchor="middle">charts, or localhost</text>
          <rect style="fill: var(--sl-color-bg)" stroke="currentColor" stroke-width="1.2" x="400" y="16" width="100" height="40" rx="4"/>
          <text font-size="13" font-weight="600" fill="currentColor" x="450" y="34" text-anchor="middle">Identity</text>
          <text font-size="11" fill="currentColor" fill-opacity="0.7" x="450" y="48" text-anchor="middle">auth.flyindycenter.com</text>
          <rect style="fill: var(--sl-color-bg)" stroke="currentColor" stroke-width="1.2" x="580" y="16" width="100" height="40" rx="4"/>
          <text font-size="13" font-weight="600" fill="currentColor" x="630" y="34" text-anchor="middle">VATSIM</text>
          <text font-size="11" fill="currentColor" fill-opacity="0.7" x="630" y="48" text-anchor="middle">Connect</text>
          <line stroke="currentColor" stroke-opacity="0.35" stroke-width="1" stroke-dasharray="3 4" x1="90" y1="56" x2="90" y2="670"/>
          <line stroke="currentColor" stroke-opacity="0.35" stroke-width="1" stroke-dasharray="3 4" x1="270" y1="56" x2="270" y2="670"/>
          <line stroke="currentColor" stroke-opacity="0.35" stroke-width="1" stroke-dasharray="3 4" x1="450" y1="56" x2="450" y2="670"/>
          <line stroke="currentColor" stroke-opacity="0.35" stroke-width="1" stroke-dasharray="3 4" x1="630" y1="56" x2="630" y2="670"/>
          <text font-size="11" fill="currentColor" fill-opacity="0.6" style="font-family: var(--sl-font-mono)" x="20" y="94">1</text>
          <line fill="none" stroke-width="1.3" x1="90" y1="90" x2="268" y2="90" marker-end="url(#ah1)" stroke="currentColor"/>
          <text font-size="12" fill="currentColor" x="180" y="84" text-anchor="middle">opens the app, not logged in</text>
          <text font-size="11" fill="currentColor" fill-opacity="0.6" style="font-family: var(--sl-font-mono)" x="20" y="138">2</text>
          <line fill="none" stroke-width="1.3" stroke-dasharray="5 4" x1="270" y1="134" x2="92" y2="134" marker-end="url(#ah1)" stroke="currentColor"/>
          <text font-size="12" fill="currentColor" x="180" y="128" text-anchor="middle">"Connect with VATSIM" link</text>
          <text font-size="11" fill="currentColor" fill-opacity="0.6" style="font-family: var(--sl-font-mono)" x="20" y="182">3</text>
          <line fill="none" stroke-width="1.3" x1="90" y1="178" x2="448" y2="178" marker-end="url(#ah1)" stroke="currentColor"/>
          <text font-size="12" fill="currentColor" x="270" y="172" text-anchor="middle"><tspan font-size="11.5" style="font-family: var(--sl-font-mono)">GET /oauth/authorize?redirect_uri=…</tspan></text>
          <text font-size="11" fill="currentColor" fill-opacity="0.6" style="font-family: var(--sl-font-mono)" x="20" y="226">4</text>
          <line fill="none" stroke-width="1.3" stroke-dasharray="5 4" x1="450" y1="222" x2="92" y2="222" marker-end="url(#ah1)" stroke="currentColor"/>
          <text font-size="12" fill="currentColor" x="270" y="216" text-anchor="middle">302 to VATSIM, remembers where to return</text>
          <text font-size="11" fill="currentColor" fill-opacity="0.6" style="font-family: var(--sl-font-mono)" x="20" y="270">5</text>
          <line fill="none" stroke-width="1.3" x1="90" y1="266" x2="628" y2="266" marker-end="url(#ah1)" stroke="currentColor"/>
          <text font-size="12" fill="currentColor" x="360" y="260" text-anchor="middle">user logs in to VATSIM</text>
          <text font-size="11" fill="currentColor" fill-opacity="0.6" style="font-family: var(--sl-font-mono)" x="20" y="314">6</text>
          <line fill="none" stroke-width="1.3" stroke-dasharray="5 4" x1="630" y1="310" x2="92" y2="310" marker-end="url(#ah1)" stroke="currentColor"/>
          <text font-size="12" fill="currentColor" x="360" y="304" text-anchor="middle">302 to identity's <tspan font-size="11.5" style="font-family: var(--sl-font-mono)">/login/callback?code&amp;state</tspan></text>
          <text font-size="11" fill="currentColor" fill-opacity="0.6" style="font-family: var(--sl-font-mono)" x="20" y="358">7</text>
          <line fill="none" stroke-width="1.3" x1="90" y1="354" x2="448" y2="354" marker-end="url(#ah1)" stroke="currentColor"/>
          <text font-size="12" fill="currentColor" x="270" y="348" text-anchor="middle"><tspan font-size="11.5" style="font-family: var(--sl-font-mono)">GET /login/callback</tspan></text>
          <text font-size="11" fill="currentColor" fill-opacity="0.6" style="font-family: var(--sl-font-mono)" x="20" y="402">8</text>
          <line fill="none" stroke-width="1.3" x1="450" y1="398" x2="628" y2="398" marker-end="url(#ah1)" stroke="currentColor"/>
          <text font-size="12" fill="currentColor" x="540" y="392" text-anchor="middle">trade VATSIM's code, fetch profile</text>
          <line fill="none" stroke-width="1.3" stroke-dasharray="5 4" x1="630" y1="426" x2="452" y2="426" marker-end="url(#ah1)" stroke="currentColor"/>
          <text font-size="12" fill="currentColor" x="540" y="420" text-anchor="middle">VATSIM profile</text>
          <text font-size="11" fill="currentColor" fill-opacity="0.6" style="font-family: var(--sl-font-mono)" x="20" y="470">9</text>
          <rect style="fill: var(--sl-color-accent-low); stroke: var(--sl-color-accent)" stroke-width="1" x="366" y="452" width="168" height="36" rx="3"/>
          <text font-size="11.5" fill="currentColor" x="450" y="467" text-anchor="middle">save the user, mint a code,</text>
          <text font-size="11.5" fill="currentColor" x="450" y="481" text-anchor="middle">remember the user</text>
          <text font-size="11" fill="currentColor" fill-opacity="0.6" style="font-family: var(--sl-font-mono)" x="20" y="524">10</text>
          <line fill="none" stroke-width="1.8" style="stroke: var(--sl-color-accent)" x1="450" y1="520" x2="92" y2="520" marker-end="url(#ahk1)"/>
          <text font-size="12" font-weight="600" style="fill: var(--sl-color-accent-high)" x="270" y="514" text-anchor="middle">302 to the app with <tspan font-size="11.5" style="font-family: var(--sl-font-mono)">?code=…</tspan></text>
          <text font-size="11" fill="currentColor" fill-opacity="0.6" style="font-family: var(--sl-font-mono)" x="20" y="568">11</text>
          <line fill="none" stroke-width="1.3" x1="90" y1="564" x2="268" y2="564" marker-end="url(#ah1)" stroke="currentColor"/>
          <text font-size="12" fill="currentColor" x="180" y="558" text-anchor="middle"><tspan font-size="11.5" style="font-family: var(--sl-font-mono)">GET /?code=…</tspan></text>
          <text font-size="11" fill="currentColor" fill-opacity="0.6" style="font-family: var(--sl-font-mono)" x="20" y="612">12</text>
          <line fill="none" stroke-width="1.8" style="stroke: var(--sl-color-accent)" x1="270" y1="608" x2="448" y2="608" marker-end="url(#ahk1)"/>
          <text font-size="12" font-weight="600" style="fill: var(--sl-color-accent-high)" x="360" y="602" text-anchor="middle"><tspan font-size="11.5" style="font-family: var(--sl-font-mono)">POST /oauth/token</tspan> with the code</text>
          <line fill="none" stroke-width="1.3" stroke-dasharray="5 4" x1="450" y1="636" x2="272" y2="636" marker-end="url(#ah1)" stroke="currentColor"/>
          <text font-size="12" fill="currentColor" x="360" y="630" text-anchor="middle">session token for this app</text>
          <text font-size="11" fill="currentColor" fill-opacity="0.6" style="font-family: var(--sl-font-mono)" x="20" y="666">13</text>
          <line fill="none" stroke-width="1.3" stroke-dasharray="5 4" x1="270" y1="662" x2="92" y2="662" marker-end="url(#ah1)" stroke="currentColor"/>
          <text font-size="12" fill="currentColor" x="180" y="656" text-anchor="middle">logged-in page, app keeps the token</text>
        </g>
      </svg>
<figcaption>Steps 3 to 10 are identity's job. The app does steps 2, 11, 12 and 13, and the client library does 12 and most of 13.</figcaption>
</figure>

`/login/callback` in steps 6 and 7 is identity's address for VATSIM to return to. Apps never link to it.

## Every request after that

The app keeps the session token on its side: in an HttpOnly cookie on its own origin if it has a server, in `localStorage` if it runs only in the page. On each request it sends the token to identity and gets back who the user is: their VATSIM details, their Indy Center roles, and whether they're controlling or flying right now.

<figure style="overflow-x: auto; margin: 1rem 0">
<svg viewBox="0 0 560 210" role="img" aria-label="Sequence: the browser requests a page; the app calls identity's userinfo endpoint with the token it keeps; identity returns the user, roles and live network status; the app renders the page." width="100%" style="display: block; min-width: 520px; height: auto; font-family: var(--sl-font)"><defs><marker id="ah2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker><marker id="ahk2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill: var(--sl-color-accent)"/></marker></defs>
        <g>
          <rect style="fill: var(--sl-color-bg)" stroke="currentColor" stroke-width="1.2" x="40" y="16" width="100" height="40" rx="4"/>
          <text font-size="13" font-weight="600" fill="currentColor" x="90" y="34" text-anchor="middle">Browser</text>
          <text font-size="11" fill="currentColor" fill-opacity="0.7" x="90" y="48" text-anchor="middle">the user</text>
          <rect style="fill: var(--sl-color-bg)" stroke="currentColor" stroke-width="1.2" x="230" y="16" width="100" height="40" rx="4"/>
          <text font-size="13" font-weight="600" fill="currentColor" x="280" y="34" text-anchor="middle">App</text>
          <text font-size="11" fill="currentColor" fill-opacity="0.7" x="280" y="48" text-anchor="middle">keeps the token</text>
          <rect style="fill: var(--sl-color-bg)" stroke="currentColor" stroke-width="1.2" x="420" y="16" width="100" height="40" rx="4"/>
          <text font-size="13" font-weight="600" fill="currentColor" x="470" y="34" text-anchor="middle">Identity</text>
          <text font-size="11" fill="currentColor" fill-opacity="0.7" x="470" y="48" text-anchor="middle">RPC or HTTPS</text>
          <line stroke="currentColor" stroke-opacity="0.35" stroke-width="1" stroke-dasharray="3 4" x1="90" y1="56" x2="90" y2="200"/>
          <line stroke="currentColor" stroke-opacity="0.35" stroke-width="1" stroke-dasharray="3 4" x1="280" y1="56" x2="280" y2="200"/>
          <line stroke="currentColor" stroke-opacity="0.35" stroke-width="1" stroke-dasharray="3 4" x1="470" y1="56" x2="470" y2="200"/>
          <line fill="none" stroke-width="1.3" x1="90" y1="90" x2="278" y2="90" marker-end="url(#ah2)" stroke="currentColor"/>
          <text font-size="12" fill="currentColor" x="185" y="84" text-anchor="middle">opens any page</text>
          <line fill="none" stroke-width="1.3" x1="280" y1="128" x2="468" y2="128" marker-end="url(#ah2)" stroke="currentColor"/>
          <text font-size="12" fill="currentColor" x="375" y="122" text-anchor="middle"><tspan font-size="11.5" style="font-family: var(--sl-font-mono)">GET /oauth/userinfo</tspan> · Bearer token</text>
          <line fill="none" stroke-width="1.3" stroke-dasharray="5 4" x1="470" y1="156" x2="282" y2="156" marker-end="url(#ah2)" stroke="currentColor"/>
          <text font-size="12" fill="currentColor" x="375" y="150" text-anchor="middle">user, roles, position or flight plan</text>
          <line fill="none" stroke-width="1.3" stroke-dasharray="5 4" x1="280" y1="190" x2="92" y2="190" marker-end="url(#ah2)" stroke="currentColor"/>
          <text font-size="12" fill="currentColor" x="185" y="184" text-anchor="middle">page</text>
        </g>
      </svg>
<figcaption>A deployed Worker makes this call in-process over its service binding. Anything else makes it over HTTPS. The answer is the same.</figcaption>
</figure>

## A second app

Identity remembered the user in step 9, with a cookie of its own on `auth.flyindycenter.com`. When the user opens another Indy Center app, the login link goes to identity, identity recognizes them, and they come straight back with a code. VATSIM isn't involved.

<figure style="overflow-x: auto; margin: 1rem 0">
<svg viewBox="0 0 560 250" role="img" aria-label="Sequence: the browser follows a second app's login link to identity; identity recognizes the user and immediately redirects back to that app with a code; the app trades the code for its own session token." width="100%" style="display: block; min-width: 520px; height: auto; font-family: var(--sl-font)"><defs><marker id="ah3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker><marker id="ahk3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill: var(--sl-color-accent)"/></marker></defs>
        <g>
          <rect style="fill: var(--sl-color-bg)" stroke="currentColor" stroke-width="1.2" x="40" y="16" width="100" height="40" rx="4"/>
          <text font-size="13" font-weight="600" fill="currentColor" x="90" y="34" text-anchor="middle">Browser</text>
          <text font-size="11" fill="currentColor" fill-opacity="0.7" x="90" y="48" text-anchor="middle">known to identity</text>
          <rect style="fill: var(--sl-color-bg)" stroke="currentColor" stroke-width="1.2" x="230" y="16" width="100" height="40" rx="4"/>
          <text font-size="13" font-weight="600" fill="currentColor" x="280" y="34" text-anchor="middle">Second app</text>
          <text font-size="11" fill="currentColor" fill-opacity="0.7" x="280" y="48" text-anchor="middle">wiki, training, …</text>
          <rect style="fill: var(--sl-color-bg)" stroke="currentColor" stroke-width="1.2" x="420" y="16" width="100" height="40" rx="4"/>
          <text font-size="13" font-weight="600" fill="currentColor" x="470" y="34" text-anchor="middle">Identity</text>
          <text font-size="11" fill="currentColor" fill-opacity="0.7" x="470" y="48" text-anchor="middle">auth.flyindycenter.com</text>
          <line stroke="currentColor" stroke-opacity="0.35" stroke-width="1" stroke-dasharray="3 4" x1="90" y1="56" x2="90" y2="240"/>
          <line stroke="currentColor" stroke-opacity="0.35" stroke-width="1" stroke-dasharray="3 4" x1="280" y1="56" x2="280" y2="240"/>
          <line stroke="currentColor" stroke-opacity="0.35" stroke-width="1" stroke-dasharray="3 4" x1="470" y1="56" x2="470" y2="240"/>
          <line fill="none" stroke-width="1.3" x1="90" y1="90" x2="468" y2="90" marker-end="url(#ah3)" stroke="currentColor"/>
          <text font-size="12" fill="currentColor" x="280" y="84" text-anchor="middle"><tspan font-size="11.5" style="font-family: var(--sl-font-mono)">GET /oauth/authorize?redirect_uri=…</tspan>, user known</text>
          <line fill="none" stroke-width="1.8" style="stroke: var(--sl-color-accent)" x1="470" y1="134" x2="92" y2="134" marker-end="url(#ahk3)"/>
          <text font-size="12" font-weight="600" style="fill: var(--sl-color-accent-high)" x="280" y="128" text-anchor="middle">302 straight back with <tspan font-size="11.5" style="font-family: var(--sl-font-mono)">?code=…</tspan></text>
          <line fill="none" stroke-width="1.3" x1="90" y1="178" x2="278" y2="178" marker-end="url(#ah3)" stroke="currentColor"/>
          <text font-size="12" fill="currentColor" x="185" y="172" text-anchor="middle"><tspan font-size="11.5" style="font-family: var(--sl-font-mono)">GET /?code=…</tspan></text>
          <line fill="none" stroke-width="1.3" x1="280" y1="222" x2="468" y2="222" marker-end="url(#ah3)" stroke="currentColor"/>
          <text font-size="12" fill="currentColor" x="375" y="216" text-anchor="middle"><tspan font-size="11.5" style="font-family: var(--sl-font-mono)">POST /oauth/token</tspan>, own session</text>
        </g>
      </svg>
<figcaption>Each app ends up with its own session. Logging out of one app leaves the others logged in. Identity's <code>/logout</code> logs the user out of every app.</figcaption>
</figure>

## Production and localhost

| Concern                      | `charts.flyindycenter.com`                                            | `localhost:5173`                                       |
| ---------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------ |
| Where the app sends the user | Identity's `/oauth/authorize`, with its own address as `redirect_uri` | Same                                                   |
| Allowed return addresses     | `https://flyindycenter.com` and `https://*.flyindycenter.com`         | `http://localhost`, `127.0.0.1`, `[::1]`, any port     |
| What comes back              | A code, good for 60 seconds, usable once                              | Same                                                   |
| Where the token lives        | Wherever the app keeps it                                             | Same                                                   |
| How the app reaches identity | Service binding, in-process                                           | HTTPS                                                  |
| The VATSIM account           | The user's real one                                                   | The developer's real one: same user record, same roles |

## Why a code instead of the token

The address bar is the only path from identity back to the app, and addresses get logged, bookmarked, and pasted into chat. So identity puts a 60-second, single-use code there, and the app fetches the real token over a direct HTTPS call that nothing else sees. VATSIM Connect works the same way: identity gets a code from VATSIM in step 6 and trades it for the profile in step 8. This is the OAuth 2.0 authorization-code grant, which is also why tools like Moodle and Wiki.js can use identity without custom code.

Considered, not chosen: putting the session token in the redirect. It's shorter by one call, but the token would sit in browser history and server logs for its full 30 days.

Considered, not chosen: one cookie on `.flyindycenter.com` shared by every app. It skips the code exchange in production, but it can't reach `localhost`, so development would need a second flow. It also means an XSS bug on any subdomain exposes every app's session. With a cookie per app, the damage stays in that app.
