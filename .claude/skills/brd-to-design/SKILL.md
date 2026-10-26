---
name: brd-to-design
description: Turn an approved BRD into information architecture, visual directions, a design system (tokens + components), screen specs and a clickable prototype - designed either in the repository as HTML or in Claude Design (Design and Design System artifacts) with a one-way export back into the repository. Use only when the user invokes /brd-to-design.
disable-model-invocation: true
---

# BRD → Design and design system

You turn `docs/product/BRD.md` into a design the user approves: information architecture, screen specs, prototypes and a design system. Everything lands in `docs/design/`.

Converse and write all documents in the language the user writes in.

## Preconditions

1. `docs/product/BRD.md` exists and its frontmatter says `status: approved`. If not, stop and tell the user to finish `/concept-to-brd` first. If the BRD says `ui: none`, tell the user this stage is skipped and the next step is `/tech-architecture`.
2. If `docs/design/` already has files, read them and resume from the first unfinished step below. Do not overwrite approved work.

## Hard rules

- **The BRD drives the design.** Every screen maps to at least one requirement ID (`F-xx`). A screen with no requirement is scope creep: flag it.
- **Design reveals BRD gaps.** When a screen needs a decision the BRD does not contain, stop, propose the BRD change, and edit the BRD only after the user agrees (add a change-log entry).
- **The user picks.** You build options and give an honest critique of each, including your recommendation. You never choose a variant on the user's behalf.
- **Prototypes are throwaway.** They live in `docs/design/prototypes/`, never in production source folders.
- **The repository is the source of truth.** Wherever the design is made, code, QA and reviews read only `docs/design/`. A Claude Design artifact is where the look is decided; after import its content counts only through the files in the repository. An artifact edited after import, without a new import, does not count.

## Context hygiene

Decisions live in files, not in this conversation, so a fresh session loses nothing. At the end of each phase, if the conversation has become long (many rounds, large documents read), say so and offer to continue in a fresh session with the same command; this skill resumes from the files. Never keep a stage alive just to avoid restarting.

## Change mode (brownfield)

This check runs **before** the preconditions' resume rule. If the BRD has `profile: brownfield`, its `change:` is `C-NN`, and your documents (`ia.md`, `design-system.md` and `design-decisions.md`) carry an older `change:` value, start the change: set their `status: draft` and `change: C-NN`. When the stage needs no changes for this change, still review with the user, add a change-log line "C-NN: no changes needed", and approve. Every edit gets a dated change-log line with the change ID at the end of the document.

If the BRD has `profile: brownfield`, an approved design system already describes the existing product. Work on the **delta** only:

- Step 1: show the existing design technology and ask the user to confirm it or name what changes.
- Step 2: add new screens and mark changed screens in `ia.md`; do not re-map unchanged ones.
- Step 3: visual directions only for new or changed screens, and they must fit the existing look unless the user explicitly wants a redesign.
- Step 4: extend the design system; list every token or component change with the existing screens it affects. Fixing existing inconsistencies is a separate decision for the user, not a side effect.
- Steps 5–7: as usual, for new and changed screens; write a screen spec (`screens/SC-xx-*.md`) for every new or changed screen, since QA checks tasks against them.

## Step 1 — Ask about design technology (every time)

Always ask, even if a previous project used something. You may offer the previous answer as a default, but the user must confirm. Ask in one round:

- target platforms (web, iOS, Android, desktop) and which come first,
- styling approach and component library for each platform (or "not decided yet"),
- existing brand assets (logo, colours, fonts) or none,
- accessibility target (recommend WCAG 2.2 AA unless the user has a reason not to; if the BRD says the product falls under the European Accessibility Act or public-sector rules, AA is the minimum, not a recommendation),
- light/dark mode, supported languages, right-to-left needs,
- **where the look is designed:**
  - `claude-design` (recommended): directions, design system and screens are made as Claude Design artifacts (the Design and Design System artifact types in the Claude app), where the user compares variants side by side and edits them directly; the result is exported once into the repository;
  - `repo`: everything as self-contained HTML in `docs/design/prototypes/`, without leaving Claude Code (choose when the user does not use the Claude app, or for a very small UI).

Record the answers in `docs/design/design-decisions.md`, including a line `design_tool: claude-design` or `design_tool: repo` (the design checker reads it).

## Step 2 — Information architecture

Write `docs/design/ia.md` from `templates/ia.md` (read it now):

- a screen list with IDs (`SC-01`, …), each linked to `F-xx` IDs,
- navigation structure,
- one Mermaid flowchart per core journey from the BRD (`J-xx`).

Check coverage: every `must` requirement appears on at least one screen. Report gaps. Get the user's approval of the IA before visual work.

## Step 3 — Visual directions

**With `design_tool: claude-design`,** Steps 3 and 4 happen in Claude Design; go to **Step 3C** below and come back at Step 5.

For the 2–3 most important screens, build **2–3 radically different directions** (different layout and hierarchy, not just colours) as one self-contained HTML file: `docs/design/prototypes/directions.html`, switchable with buttons and a `?variant=` URL parameter. Use realistic content from the BRD, not lorem ipsum.

Give an honest critique of each direction (strengths, weaknesses, fit with personas) and your recommendation. The user chooses, or combines ("header from B, list from C"). Record the choice in `design-decisions.md`.

## Step 4 — Design system

Derive the design system from the chosen direction, not in a vacuum. Write:

- `docs/design/tokens.json` — platform-agnostic tokens in the W3C design-tokens format (nested groups, each token `{ "$type": …, "$value": … }`; light colour values here, dark ones under the same names in `tokens.dark.json`): semantic colours, typography scale, spacing scale, radii, elevation, motion durations. Name tokens by role (`color.text.primary`), not by value (`blue-500`).
- `docs/design/design-system.md` from `templates/design-system.md` (read it now): principles, token reference, component inventory with variants and states, accessibility rules, do/don't examples.

Read the "Design" table of `references/accessibility.md` and apply it: focus style, minimum target size per platform, single-pointer alternatives for drag actions, motion rules. Fill the "Contrast pairs" table in `design-system.md` with every text/background and component/background combination the screens use; the checker computes them. A failing pair is fixed in the tokens, never by lowering the target.

Only include components the screens actually need. A component nobody uses is speculative.

Copy `scripts/design-check.mjs` from this skill into the repository's `scripts/` (if it is not there yet) and run `node scripts/design-check.mjs`. Fix every error, including every failing contrast pair.

## Step 3C — Claude Design (only with `design_tool: claude-design`)

**Brief.** Write `docs/design/claude-design-brief.md` from `templates/claude-design-brief.md` (read it now). Fill it from the BRD, `ia.md` and `design-decisions.md`: product, personas, constraints, key screens for directions, the full screen list with the states to show, navigation and journeys, realistic content, business rules visible on screens. In change mode (brownfield) the brief covers only new and changed screens and says the result must fit the existing design system: attach the current `tokens.json` values to the brief and ask for changes to them, not a new system.

**Hand-off.** If this session itself can create Claude Design artifacts (a tool that publishes from the Design and Design System artifact types), you may work through the brief here. Otherwise tell the user, in a few lines: open a new conversation in the Claude app, attach `docs/design/claude-design-brief.md`, write "Work through this brief step by step", choose the direction and approve the design system there, then download the export files into `docs/design/import/` and run `/brd-to-design` again. Stop here; the next run resumes at the import. If a later run finds the brief but no export files in `docs/design/import/`, repeat these instructions and stop.

**Import** (when `docs/design/import/` has the export files):

1. Check that all expected files are there: `tokens.json`, `design-system-export.md`, `screens-export.md`, `open-questions.md`, and `tokens.dark.json` if the design has a dark theme. Missing files: tell the user exactly which, stop.
2. In change mode, first show the user the token differences against the current `docs/design/tokens.json` and the existing screens each change affects; import only after they agree. Copy `tokens.json` (and `tokens.dark.json`) to `docs/design/`. Copy `scripts/design-check.mjs` from this skill into the repository's `scripts/` if needed and run `node scripts/design-check.mjs`. Errors (invalid JSON, dark names that do not match, value-named tokens components use directly) go back to the user as precise corrections to ask for in the Claude Design conversation; do not hand-edit the tokens to hide them, except trivial format fixes the user agrees to.
3. Write `docs/design/design-system.md` from `templates/design-system.md` using `design-system-export.md`: principles, token tables generated from `tokens.json` (not retyped), components, the "Contrast pairs" table from the export; set `design_tool: claude-design`, `artifact:` and `imported:` in its frontmatter. Run `node scripts/design-check.mjs`: it computes every contrast pair. Failing pairs go back to the user as corrections for the Claude Design conversation (exact token, current and required ratio). Compare the export's accessibility rules with the "Design" table of `references/accessibility.md` and list what is missing.
4. `open-questions.md`: each question is a possible BRD gap; handle it under the hard rule "Design reveals BRD gaps".
5. Record in `design-decisions.md`: chosen direction, links to the Design and Design System artifacts, import date. Commit the imported files (`design: import from Claude Design`). Keep `docs/design/import/` as it is until the next import; it shows exactly what was imported.

Then continue with Step 5. The screen specs are written from `screens-export.md`.

## Step 5 — Screen specs

For each screen write `docs/design/screens/SC-xx-<slug>.md` from `templates/screen.md`: purpose, requirements covered, layout, components used, all states (empty, loading, error, success, no permission), interactions, copy, accessibility notes per the "Design" table of `references/accessibility.md` (focus after each action, announcements, targets, drag alternatives). With `design_tool: claude-design`, take them from `screens-export.md`, set `design:` in the frontmatter to the artifact link and artboard name, and fill in every state the export does not show, marked "not designed: follows the design system". Run `node scripts/design-check.mjs`: every screen in `ia.md` needs a spec.

## Step 6 — Clickable prototype of the core flow

Build `docs/design/prototypes/core-flow.html`: a self-contained HTML file using the design tokens from `docs/design/tokens.json` (also with `design_tool: claude-design`: the prototype is where the imported tokens are proven to work), covering the main journey end to end with in-memory state. It exists to validate the flow, not to become production code.

## Step 7 — Approval

Present a summary: screens, components, open issues, BRD changes made. When the user explicitly approves, set `status: approved` and `approved: <date>` in the frontmatter of `design-system.md` and `ia.md`, and tell the user the next step is `/tech-architecture`.

## After approval: changing the design

- **Small changes** (a token value, a component state): edit `tokens.json` / `design-system.md` in the repository through change mode, with a change-log line. With Claude Design, tell the user the artifact is now older than the repository, or make the same change there; the repository wins.
- **Larger changes** (new screens, a new look for an area): change mode with a delta brief (Step 3C) and a new import.
- Code is held to the repository: `node scripts/design-check.mjs --scan <UI source dirs>` finds hard-coded colours; `/review-change` and `/qa-task` run it.
