---
name: docs-voice
description: Use when writing or editing any documentation page in this repo, and always before marking content work complete. Encodes the house voice derived from Indy Center's existing technical writing.
---

# Docs voice

Documentation here should read like the org's existing technical writing: `DEVELOPER_GUIDE.md`,
the design docs, and the project READMEs. This rubric is derived from that corpus, not from
general style advice.

## Em dashes stay

The existing technical writing uses em dashes freely — `DEVELOPER_GUIDE.md` alone has 25, the
tech-vision spec 29. Do not strip them to look less machine-written. That rule belongs to a
different register and would make these docs read less like the people who wrote them.

## Structure

Open with one or two sentences saying what the thing is, what it does, and who calls it.
`README-TEMPLATE.md` codifies this: "One sentence: what this project is and what it does.
Who calls it and how (HTTP, RPC, cron, etc.)."

Planning and design docs carry a **Status** line near the top.

Division of labor between formats:

- **Tables** for enumerable structured data with a few fixed columns — bindings, project
  maps, RPC surfaces. Never for reasoning.
- **Bullets** for routes, files, and one-line item descriptions.
- **Prose** for rationale, tradeoffs, and anything causal. Reasoning is never bulletized.

Code blocks are load-bearing. Show the actual command or config rather than describing it.
Footgun warnings belong in code comments, not in surrounding prose:

```ts
// Browsers ignore Domain=.flyindycenter.com on localhost, so logout would
// silently no-op in dev. Omit the domain locally.
```

Blockquotes do two jobs and no others: a "why" aside for a decision a reader would
question, and template/meta instructions.

Headings are sentence-case noun phrases. No question marks, no cute matched pairs.

## Sentences

Short-to-medium declaratives, with occasional terse fragment bursts for emphasis:
"No HTTP between workers. No shared secrets. No CORS." Keep such fragments short and
concrete — never three inflated abstract nouns.

Third person and imperative second person for describing systems and giving instructions.
First person singular when thinking out loud about something unresolved. First person
plural for team decisions.

Contractions are used freely in prose.

Default to direct and declarative. Confine hedging to a labeled "Open questions" section,
and make each open item resolve to a lean rather than trailing off: "Defer; start with
in-repo and migrate later if size becomes a problem."

Semicolons join tightly related clauses rather than splitting into two sentences.

## Signature moves worth preserving

- **"Considered, not chosen: X"** — name the rejected alternative and one concrete reason
  it lost. Do not present only the chosen path.
- **A "why" callout** for any decision a reader might question.
- **Bold-label bullets**: a short noun-phrase label ending in a period, then the
  explanation in the same bullet.
- **State a rule, then carve out the exception** so the rule is not over-applied.
- **End plans and specs with an explicit scope fence** — "Out of scope" — rather than
  letting scope drift unstated.

## Anti-patterns

All of the following are grep-verified as absent from the corpus. Their presence in a
draft is a defect.

| Strip                                                                                           | Why                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Moreover`, `Furthermore`, `In conclusion`, `Additionally`, `It is worth noting`                | Zero hits in corpus. Ideas connect with semicolons, "but", "so", or nothing.                                                                                    |
| `powerful`, `seamless`, `robust`, `comprehensive`, `cutting-edge`, `leverage`, `utilize`        | Zero hits. Describe what a thing does; do not praise it.                                                                                                        |
| Emoji                                                                                           | Zero anywhere in the corpus.                                                                                                                                    |
| Exclamation points                                                                              | Zero rhetorical uses. The only `!` in the corpus are TS negation and markdown badges.                                                                           |
| Question-mark headings                                                                          | Zero. State the topic as a noun phrase.                                                                                                                         |
| "It's not just X, it's Y"                                                                       | Zero hits.                                                                                                                                                      |
| Over-signposting — "In this section we will", "As mentioned above"                              | Not present. Just state the thing.                                                                                                                              |
| Bulleted reasoning                                                                              | Reasoning is prose. Bullets are for enumerable items.                                                                                                           |
| Hedging to avoid committing — "could potentially", "it's possible that", "may want to consider" | Uncertainty is scoped to Open questions and resolves to a decision. Describing a real failure mode ("the call hangs if identity isn't running") is not hedging. |

## Checklist

Run these against any draft page before calling it done.

1. Does it open with what this is / what it does / who it is for, before anything else?
2. Are enumerable facts in tables or bullets, and all reasoning in prose?
3. Does every nontrivial code snippet show the real command rather than paraphrasing?
4. Do non-obvious lines carry an inline comment explaining why, especially footguns?
5. Is there a "why" callout for any decision a reader would question?
6. Where an alternative was rejected, is it named with one concrete reason?
7. Zero hollow transitions?
8. Zero hype adjectives?
9. Are all headings plain sentence-case noun phrases — no questions, no emoji?
10. Is uncertainty confined to a labeled section, and does each item state a lean?
11. Are contractions used naturally rather than stiffly avoided?
12. Zero emoji and zero rhetorical exclamation points?
13. Were em dashes left alone? They are correct here.
14. Would a reader who has never seen this codebase know what to do next?
