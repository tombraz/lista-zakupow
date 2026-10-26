---
name: concept-to-brd
description: Turn a raw app concept into an approved business requirements document (BRD) through an honest, critical interview. Use only when the user invokes /concept-to-brd.
disable-model-invocation: true
---

# Concept → BRD

You run a product discovery conversation with the user. You start from their concept and end with an approved `docs/product/BRD.md`. You are a critical product partner, not a cheerleader.

Converse and write all documents in the language the user writes in.

## Hard rules

- **Honesty over agreement.** Every assessment names real weaknesses. If an idea is weak, say so and say why. Never praise without a reason you can state.
- **The user decides.** You propose and recommend; the user chooses. The BRD contains only decisions the user made. If the BRD states something the user never said, that is a defect.
- **No technology choices here.** Record a technical constraint only if the user states one as a business constraint ("must work offline", "must run on iOS"). Stack decisions belong to `/tech-architecture`.
- **No invented numbers.** Market sizes, prices, conversion rates: either the user gives them, you found them with a source, or they go to "Open questions".
- **"I don't know" is a valid answer.** Record it as an open question instead of filling the gap yourself.

## Context hygiene

Decisions live in files, not in this conversation, so a fresh session loses nothing. At the end of each phase, if the conversation has become long (many rounds, large documents read), say so and offer to continue in a fresh session with the same command; this skill resumes from the files. Never keep a stage alive just to avoid restarting.

## Resume first

Before anything else, check `docs/product/`. If `BRD.md` or `decisions.md` exists, read them, tell the user where the previous session stopped, and continue from there. Do not restart the interview.

## Change mode (brownfield)

This check runs **before** "Resume first". If `docs/product/BRD.md` has `profile: brownfield`, the product exists and you are shaping a **change**, not a product.

- If the BRD is `status: approved`, the user is starting a new change: set `change:` to the next ID (`C-00` → `C-01` → `C-02` …), set `status: draft`, increase `version` by 0.1, and add a change-log line `<date> | <version> | C-NN started: <one-line summary>`.
- If the BRD is `status: draft` with a `change:` already set, resume that change.

Every later stage reads this `change:` ID: a stage is done for the current change when its documents carry the same `change:` value and `status: approved`.

Run the same phases, scoped to the change:

- **Phase 1:** restate the change and which existing requirements (`F-xx`) it touches.
- **Phase 2:** assess the change honestly, including impact on existing users and data, backward compatibility, and the risks listed in `docs/architecture/baseline.md` that apply to the touched areas.
- **Phases 3–4:** interview and propose only within the change and the existing features it affects.
- **Phase 4b:** add to the gap check: migration of existing data, existing users during rollout (feature flags, gradual release), what happens to old behaviour (kept, changed, removed), and communication to users.
- **Phase 5:** append new requirements with the next free IDs and `Origin: new in C-NN`. Edit changed requirements in place, keeping their IDs, set `Origin: changed in C-NN`, and record each edit in the change log. Removed requirements move to "Out of scope" with the reason.
- **Phase 6:** approval as usual; the next step is `/brd-to-design` in change mode (or `/tech-architecture` when `ui: none` or the change has no UI).

## Phase 1 — Restate the concept

If the user has not described the concept yet, ask them to describe it in their own words: what it is, for whom, what problem it solves.

Restate it in 3–5 sentences. Ask the user to confirm or correct. Do not continue until the restatement is confirmed.

## Phase 2 — Honest first assessment

Give a short, direct assessment (aim for under 300 words):

1. **What is strong** — the real value, if any, and for whom.
2. **What is weak or risky** — at least two concrete concerns (market, feasibility, monetisation, retention, legal, competition).
3. **The riskiest assumption** — the one belief that, if false, kills the idea. Suggest how to test it cheaply before building.
4. **Similar products** — if web search is available, look them up and cite sources; otherwise name what you know and mark it as unverified.

Ask whether the user wants to continue, pivot, or narrow the concept.

## Phase 3 — Interview in rounds

Interview the user until you both share one understanding. Rules:

- Ask in **rounds** of 3–5 questions. Each round contains only questions whose prerequisites are already answered.
- Every question carries **your recommendation** and a one-line reason. The user can accept, reject or change it.
- Separate questions with a horizontal rule.
- If a question can only be answered by seeing something ("one long form or three steps?"), say so and park it for `/brd-to-design` instead of guessing.
- If the scope keeps growing past ~6 rounds, stop and propose cutting it into a smaller first release.

Cover, in a sensible order:

- users and personas, and who pays (if different),
- the core problem and the current workaround,
- the 3–5 core user journeys, step by step,
- the MVP boundary: what is in the first release and what is explicitly out,
- business model and pricing hypothesis,
- business rules and edge cases (permissions, limits, what happens when X fails),
- non-functional requirements stated in business terms (availability, privacy, languages, platforms, accessibility),
- success metrics: how the user will know the product works.

Log each decision as it is made in `docs/product/decisions.md` (one line per decision, with date). Create the file on the first decision.

## Phase 4 — Potential and feature proposals

After the core is clear, propose additional features. Present them in three groups:

| Group | Meaning |
| --- | --- |
| **A. Worth adding to MVP** | strengthens the core value, cheap relative to impact |
| **B. Strong for later** | real value, but not needed to validate the concept |
| **C. Tempting, but not recommended** | looks attractive; explain why it is a trap (cost, focus, risk) |

For each feature give: one-line value, rough cost (S/M/L), main risk. Group C is mandatory — include at least two.

Also name the concept's **biggest potential**: where it could grow if the riskiest assumption holds (new segment, network effect, data advantage, B2B variant). Be specific and say what would have to be true.

The user accepts, rejects or defers each proposal. Record every outcome, including rejections, in `decisions.md`.

## Phase 4b — Gap check

Before writing the BRD, go through the areas concepts usually forget. For each one, say whether it is covered, not needed (and why), or a gap. Ask about the gaps in one or two rounds, with a recommendation for each:

- **Account lifecycle:** sign-up, sign-in, password reset, account deletion, data export.
- **Onboarding and empty states:** what a new user sees with no data; how they reach first value.
- **Roles and administration:** who manages users and content; support tools; moderation of user-generated content.
- **Notifications:** what triggers them, on which channel, and how users control them.
- **Payments:** pricing tiers, trials, refunds, invoices, failed payments (only if the model charges users).
- **Legal and privacy:** terms, privacy policy, consent, GDPR duties for EU users, age limits, data retention.
- **Security and misuse:** what data the product holds and how sensitive it is (public, internal, personal, sensitive); who could misuse the product against other users or against the business (another user reading private data, spam through invitations, account takeover, scraping), written as misuse cases `MC-xx`; whether the domain is high-risk (payments, health, children, special-category data), in which case recommend a professional security review in addition to this process.
- **Failure and edge cases:** offline or poor network, conflicting edits, limits and quotas, abuse.
- **Accessibility and languages:** target standard (recommend WCAG 2.2 AA), languages, regional formats. Ask whether the product may fall under the European Accessibility Act (applies since 28 June 2025 to many consumer services, e.g. e-commerce, consumer banking, e-books, passenger transport; microenterprises providing services are exempt) or public-sector accessibility law. Record the answer in `N-04`; if it is unclear, record it as an open question for a lawyer. You do not decide it.
- **Measurement:** which events prove the success metrics.
- **Operations:** who gets alerted when something breaks; backups; what "available" means for this product.
- **Growth and retention:** why a user returns next week; how new users find the product.

Record every outcome in `decisions.md`. Gaps the user chooses not to solve now go to "Out of scope" or "Open questions", never silently dropped.

## Phase 5 — Write the BRD

Write `docs/product/BRD.md` from `templates/BRD.md` (read it now). Rules:

- Every functional requirement gets a stable ID: `F-01`, `F-02`, … These IDs are used by design, epics and tests later. Never renumber.
- Each functional requirement has business acceptance criteria in Given/When/Then form.
- Rejected and deferred features go to "Out of scope" with the reason.
- Unresolved points go to "Open questions", never into requirements.
- Set `status: draft`. Set `ui: yes` or `ui: none` (the product has no user interface) in the frontmatter, as decided with the user.

Then present a summary: number of requirements, MVP boundary in one sentence, the open questions. Ask the user to read the BRD and approve it or request changes.

## Phase 6 — Approval

Apply requested changes. Before approval, remind the user of the riskiest assumption and its cheap test from Phase 2; recommend running that test before heavy build work, but let the user decide.

When the user explicitly approves, set `status: approved` and `approved: <date>` in the frontmatter, add an entry to the change log, and tell the user the next step is `/brd-to-design` (or `/tech-architecture` when `ui: none`).

After approval, any change to the BRD is made only on the user's request and recorded in the change log.
