---
name: adopt-codebase
description: One-time onboarding of an existing (brownfield) codebase into the pipeline - discover the stack, architecture, data model, API, UI, tests and CI/CD from the code, measure a baseline by running what exists, and write the same docs the greenfield stages produce, marked as discovered and confirmed by the user. Use only when the user invokes /adopt-codebase.
disable-model-invocation: true
---

# Adopt an existing codebase

You turn an existing repository into a project the rest of the pipeline can work on. You **read and run**, you do not change product code. The output is the same set of documents greenfield stages produce (`docs/product/`, `docs/design/`, `docs/architecture/`), describing the product **as it is today**, plus a baseline of its health.

Converse and write all documents in the language the user writes in.

## Hard rules

- **Facts from code, intent from the user.** Code tells you what exists; it does not tell you why, for whom, or what is a bug versus a feature. Mark every statement in the documents as **discovered** (with evidence: file path or command output) or **confirmed** (the user said so). Inferences stay marked "to confirm" until the user confirms them.
- **No changes to product code, tests, CI or settings.** You may add files under `docs/` and `scripts/backlog-check.mjs` only. Install dependencies and run builds or tests only after telling the user what you will run; revert anything they change in tracked files.
- **No judgement without evidence.** "This module is messy" is not a finding; "this 1,400-line file changed in 38 of the last 100 commits and has no tests" is.
- **Ask about technology every time.** Even though the stack is discovered, confirm it with the user; parts of it may be legacy they want to replace.

## Context hygiene

Discovery reads a lot of code. Run each discovery area in its own subagent (e.g. an `Explore` subagent) and keep only its summary: findings with file references, no code dumps. Write each document as soon as its area is done. If the session grows long, stop after a finished document and offer to continue in a fresh session; this skill resumes from the documents.

## Step 0 — Scope and resume

1. If `docs/architecture/baseline.md` exists, read it and the other documents, tell the user where adoption stopped, and continue from there. If adoption is complete and the user wants to adopt **another area** of the repository, extend the `scope:` in the baseline and add the new area to every document (each addition marked `C-00 (extended <date>)`).
2. The working tree must be clean. Ask the user:
   - what they want to do next with this codebase (a new feature, a rewrite of one area, stabilisation): it focuses discovery,
   - whether to adopt the whole repository or one area (large monorepos: start with the area the next change touches); record it as `scope:` in the baseline, and use scoped test commands for it in the layer guides,
   - who knows the product best (if not the user) and whether there are existing documents, tickets or a design file to read.

## Step 1 — Discover (one subagent per area, in parallel where possible)

| Area | Look at | Summarise |
| --- | --- | --- |
| Stack and tooling | manifests, lockfiles, build files, Dockerfiles, runtime versions, linters, formatters | languages, frameworks, versions, package managers, outdated or end-of-life versions |
| Structure and layers | directory layout, entry points, module boundaries, how parts talk | layers (db, backend, web, mobile, infra…) with real paths; dependencies between modules |
| Data | migrations, ORM entities, schema files, seeds | entities and relations, migration tool, personal data fields |
| API and integrations | routes, controllers, API specs, clients, external services, env variable names | endpoints or operations, auth model, external dependencies |
| UI | routes and screens, components, theme/style files, existing tokens | screen list, component inventory, design values in use and their inconsistencies |
| Tests | test folders, frameworks, CI test steps | what is tested at which level, what has no tests, where there are no seams to test from |
| CI/CD and hosting | workflow files, deploy scripts, infrastructure files, hosting configs | pipeline as it is, environments, how deploys happen, manual steps |
| Change hotspots | `git log` (files changed most in recent history), authors, open TODO/FIXME | where change concentrates; where risk and value meet |
| Risks | committed secrets, unsafe defaults, known-vulnerable dependencies (audit tools if available), dead code | concrete risks with evidence |

## Step 2 — Measure the baseline

Tell the user which commands you will run, then run them and record results (never fix anything):

- install, build,
- lint and type check: record the number of violations per tool (and per file if the tool reports it), or use the tool's own baseline feature if it has one; new work may not increase them,
- the full test suite: number passed, failed, skipped, duration; list the failing and flaky tests by name,
- coverage if the project already measures it.

If something cannot run (missing secrets, services, documentation), record it as an open question with what is needed, and set `runnable: partial` or `runnable: no` in the baseline. `/plan-backlog` will then put "make it runnable" first. If there are no tests at all, say so plainly; `/plan-backlog` will plan a test harness.

Write `docs/architecture/baseline.md` from `templates/baseline.md` (read it now). The baseline is the yardstick for every later QA round: new work must not add failing tests, and pre-existing failures are listed by name.

## Step 3 — Write the architecture documents (as-is)

Using `/tech-architecture`'s templates (`.claude/skills/tech-architecture/templates/`, or under `~/.claude/skills/`), write with frontmatter `status: draft`, `source: discovered` and `change: C-00`:

- `tech-stack.md` — as found, with versions and evidence,
- `architecture.md` — context, containers, modules, auth, as they are; mark areas you could not map,
- `data-model.md` — entities, relations, personal data inventory,
- `api.md` — endpoints or operations found,
- `testing-strategy.md` — the levels and tools that exist today, plus a "Gaps" section,
- `threat-model.md` — assets and data classes found, trust boundaries as they are, threats derived from the risks found (missing authorisation checks, exposed secrets, unsafe defaults) and from the product's purpose, each with its current mitigation (or "none") and `Covered by` left empty until the user decides; ASVS level to confirm,
- `CODING_STANDARDS.md` — tools already configured (enforced) and conventions inferred from the code, each inferred convention marked "to confirm",
- `layers/<layer>.md` — one per layer, including `infra` for CI/CD and deployment, with **real paths and commands that you ran successfully** (commands that could not run are marked so), conventions to confirm, and pitfalls found.

## Step 4 — Write the product documents (as-is)

1. **BRD as-is.** Using `/concept-to-brd`'s template, write `docs/product/BRD.md` with `profile: brownfield`, `change: C-00`, `version: 1.0` and `ui: yes` or `ui: none` (whether the product has a user interface) in the frontmatter. List the features you found as functional requirements `F-01…` with **Origin: as-is** and evidence (screen, endpoint, file). Then run a short interview (one or two rounds) for what code cannot tell: personas, why the product exists, which features matter most, which behaviour is a known bug, what is no longer used.
2. **Design as-is** (only if there is a UI). Write `docs/design/design-decisions.md` (UI technology found, accessibility target and languages to confirm with the user), `docs/design/ia.md` from `.claude/skills/brd-to-design/templates/ia.md` (screens found → `F-xx`, navigation and journeys as they are today), `docs/design/tokens.json` (W3C design-tokens format, as in `/brd-to-design` Step 4) and `design-system.md` from the values and components actually in use, with a list of inconsistencies (e.g. 14 different greys). Frontmatter `status: draft`, `source: discovered`, `change: C-00`. Screen specs are written later, only for screens a change touches. Do not redesign.
3. **Deployment and pipeline as-is.** Using `/ci-cd`'s templates, write `deployment.md` and `pipeline.md` with frontmatter `source: discovered` and `change: C-00`, describing what exists, with each of the 12 pipeline stages marked present, partial or missing.

## Step 5 — Review and approval

Walk the user through every document in this order: `baseline.md`; `tech-stack.md`, `architecture.md`, `data-model.md`, `api.md`, `testing-strategy.md`, `threat-model.md` (decide coverage of each threat; unmitigated critical threats are recommended as the first safety-net tasks), `CODING_STANDARDS.md`, each `layers/*.md`; `BRD.md`; `design-decisions.md`, `ia.md`, `design-system.md` (if UI); `deployment.md`, `pipeline.md`. For each, show the items marked "to confirm" and ask. Apply corrections. Your honest summary must include the three biggest risks to making changes safely (with evidence), and where tests are missing in the areas the user wants to change next.

On explicit approval of each document, set `status: approved` and `approved: <date>`. When all are approved, tell the user the next steps:

- describe the change → `/concept-to-brd` (change mode: adds new requirements to the as-is BRD),
- then `/brd-to-design`, `/tech-architecture`, `/ci-cd` in change mode (each works on the delta),
- then `/plan-backlog`, which will put a safety net (characterisation tests, seams, missing CI gates) before the first feature tasks in the areas being changed.
