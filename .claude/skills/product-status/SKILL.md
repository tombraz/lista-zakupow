---
name: product-status
description: Show where the product is in the concept → BRD → design → architecture → backlog → implement → QA pipeline and name the next command. Read-only. Use when the user invokes /product-status or asks what to do next in this pipeline.
---

# Product pipeline status

Read-only. You change nothing (except regenerating the git-ignored `docs/backlog/board.html`); you report the state and the next step.

Answer in the language the user writes in.

## Check, in order

| Stage | Done when | Next command if not done |
| --- | --- | --- |
| 0. Adopt (brownfield) | brownfield only: `docs/architecture/baseline.md` is approved. Decide the profile from the BRD's `profile:`; if there is no BRD but the repository already has product code, ask the user whether it is greenfield or brownfield | `/adopt-codebase` |
| 1. Concept → BRD | `docs/product/BRD.md` has `status: approved` | `/concept-to-brd` |
| 2. Design | `docs/design/ia.md` and `docs/design/design-system.md` have `status: approved`, or the BRD frontmatter says `ui: none` | `/brd-to-design`; if `docs/design/claude-design-brief.md` exists and `docs/design/import/` has no `tokens.json`: finish the design in the Claude app with the brief, download the export into `docs/design/import/`, then `/brd-to-design` |
| 3. Architecture | `docs/architecture/architecture.md`, `data-model.md`, `testing-strategy.md` and `threat-model.md` have `status: approved` | `/tech-architecture` |
| 3b. CI/CD | `docs/architecture/deployment.md` and `pipeline.md` have `status: approved` | `/ci-cd` |
| 4. Backlog | at least one epic has `approved:` set, it has tasks, and `node scripts/backlog-check.mjs` passes | `/plan-backlog` |
| 5. Build | tasks exist with status `todo`, `in-progress` or `in-qa` | see below |

For stage 5, run `node scripts/backlog-check.mjs --board` and report the following. `--board` regenerates `docs/backlog/board.html`, a generated, git-ignored file and the only thing this skill writes; mention it once so the user can open the visual board. Add `--lang pl` when the user writes Polish (board labels exist in English and Polish). Then:

- tasks `in-qa` → `/qa-task T-NNN` in a fresh session (QA first: it unblocks other tasks),
- tasks `in-progress` with a failed QA round → `/implement-task T-NNN` to fix,
- ready tasks → `/build-epic` (automated loop with implementer and QA subagents) or `/implement-task` in a fresh session (manual),
- tasks `blocked` → show `blocked_reason`; usually `/plan-backlog` (change request) resolves it,
- an epic `done` whose pull request (`pr:` in `epic.md`) is still open → the user merges it (then staging, production approval),
- epics `in-uat` (listed in the checker's `--json` output under `epics`), in this order: `/review-change E-xx` if the latest `docs/reviews/E-xx-*.md` is missing or says `Verdict: fail`; then `/security-review E-xx` if the latest `docs/security/reviews/E-xx-*.md` is missing or says `Verdict: fail`; then `/qa-task E-xx` to confirm UAT. Open fix tasks from either review come first,
- the user wants a review of their own change, a branch or a pull request → `/review-change <branch | PR>`,
- an epic fully done and others without tasks → `/plan-backlog` for the next epic,
- fix tasks (`docs/backlog/fixes/`, `kind: fix`) in `in-progress` or `in-qa` → finish them with `/fix` (it resumes from the task file) or `/qa-task T-NNN`,
- a bug or small change to report → `/fix`,
- checker errors → fix the backlog first.

In a brownfield project (`profile: brownfield` in the BRD), stages 1–4 run once per change. The BRD's `change:` (e.g. `C-02`) is the current change. A stage is done for it when its documents have `status: approved` **and** the same `change:` value; the backlog stage is done when an approved epic has that `change:`. When the BRD is approved and every epic of the current change is `done`, the next change starts with `/concept-to-brd`.

## Report format

Keep it under 15 lines: one line per stage (done / in progress / not started), counts of tasks by status, open questions from the BRD that block anything, and **one** recommended next command with the reason.
