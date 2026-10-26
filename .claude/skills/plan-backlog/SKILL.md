---
name: plan-backlog
description: Turn an approved BRD, design and architecture into epics, stories and TDD-ready tasks with explicit dependencies and QA plans, stored as markdown in docs/backlog/. Confirms technology with the user on every run and handles requirement changes. Use only when the user invokes /plan-backlog.
disable-model-invocation: true
---

# BRD + design + architecture → epics, stories, tasks

You turn `docs/product/BRD.md`, `docs/design/` and `docs/architecture/` into a backlog in `docs/backlog/`: epics, user stories and tasks. Every task is written test-first, has a QA plan, and declares which tasks it depends on.

Converse and write all documents in the language the user writes in.

## Preconditions

1. `docs/product/BRD.md` has `status: approved`.
2. `docs/design/ia.md` and `docs/design/design-system.md` have `status: approved`, unless the BRD says `ui: none`.
3. `docs/architecture/architecture.md` and `docs/architecture/testing-strategy.md` have `status: approved`.
3a. `docs/architecture/threat-model.md` has `status: approved`. If it does not exist (an older project), stop and send the user to `/tech-architecture` (Step 5b).
3b. `docs/architecture/deployment.md` and `docs/architecture/pipeline.md` have `status: approved` (from `/ci-cd`). If the user decided to run locally only for now, those documents say so and are still approved.
4. If any is missing, stop and name the skill to run first (`/concept-to-brd`, `/brd-to-design`, `/tech-architecture`, `/ci-cd`).
5. If `docs/backlog/` exists, read it and continue planning; never renumber existing IDs.

## Hard rules

- **Confirm technology every run.** Never assume the stack from memory, another project or an earlier epic.
- **Vertical slices.** A task delivers behaviour someone can demonstrate, through all the layers it needs. "All the database tables" or "all the endpoints" is not a task.
- **One task = one agent session.** If a task would not fit one fresh context window, split it.
- **Explicit dependencies.** Every task has `depends_on` (possibly `[]`). A dependency means "this task cannot start before that one is done (QA passed)", nothing weaker.
- **Test-first by construction.** Every task lists its tests before its implementation notes. Every acceptance criterion must be checkable and must fail before the work is done.
- **QA-ready by construction.** Every task has a QA plan: what an independent tester should try beyond the automated tests.
- **Traceability.** Stories link to `F-xx`; UI tasks link to `SC-xx`; tasks for non-functional work link to `N-xx`.
- **Nothing is published without the user's approval** at each gate below.

## Context hygiene

Decisions live in files, not in this conversation, so a fresh session loses nothing. At the end of each phase, if the conversation has become long (many rounds, large documents read), say so and offer to continue in a fresh session with the same command; this skill resumes from the files. Never keep a stage alive just to avoid restarting.

Plan one epic's tasks per session.

## Step 0 — Install the checker

If `scripts/backlog-check.mjs` does not exist in the repo, copy it from this skill's `scripts/backlog-check.mjs`. It validates dependencies and statuses and finds tasks ready to start. Commit it with the backlog and add it to CI as described in `testing-strategy.md`. Add `docs/backlog/board.html` to `.gitignore`: it is the generated visual board (see Step 5), regenerated on every run, and would only add noise to commits.

**Permission guard rails.** Install the project's Claude Code permission rules from `templates/claude-settings.json` into `.claude/settings.json`:

- No file yet: copy the template.
- A file exists: add every rule from the template that is missing from its `deny`, `ask` and `allow` lists. Never remove or loosen a rule that is already there; if an existing `allow` rule contradicts a template `deny` rule, show it to the user (the deny wins anyway).

What the rules do, in one short paragraph for the user: **deny** (holds in every permission mode, also in auto mode) keeps the agents from reading secret files (`.env`, keys; `.env.example` stays readable) and from force pushes and commands that destroy work (`git reset --hard`, `git clean`, `git stash drop`, `git branch -D`); **ask** makes every `git push`, pull request merge, release and manual workflow run wait for the user (no skill in this package pushes; that is the user's step); **allow** lets the two checker scripts run without a prompt. Mention two limits honestly: rules match the command as written, so they stop the usual forms, not every possible spelling (for an OS-level boundary, the user can turn on Claude Code's sandboxing); and `.claude/` is a protected path, so Claude Code asks the user before this file is written. Commit it with the backlog.

## Step 1 — Confirm technology (every run)

On every run (new epic, resumed run or change request) show a short summary of `docs/architecture/tech-stack.md` plus the epic's "Technology" section if it exists, and ask:

- Does the epic being planned use this stack unchanged?
- Is anything new needed for it (library, service, platform)?

The user must answer explicitly. If anything changes, record it in that epic's `epic.md` under "Technology" with the date, update `tech-stack.md` if it is a project-wide change, and write an ADR if it is hard to reverse.

## Step 2 — Epics

Group requirements into epics. Each epic delivers a capability a user notices. Write `docs/backlog/E-xx-<slug>/epic.md` from `templates/epic.md` (read it now).

- Greenfield: the first epic is the thinnest end-to-end product, a walking skeleton plus one core journey. Brownfield: epics cover only the current change (`change:` in the BRD); each epic gets `change: C-NN` in its frontmatter.
- Coverage check: every `must` requirement `F-xx` belongs to an epic (brownfield: only requirements with `Origin: new in C-NN` or `changed in C-NN` for the current change); every `N-xx` is either handled inside feature tasks (stated in their acceptance criteria) or has its own task; every BRD success metric has instrumentation planned (analytics events per `architecture.md`); privacy duties from `data-model.md` (data export, deletion, consent) are planned; every threat in `threat-model.md` with `Covered by: task` is listed in the `threats:` of at least one task with a negative acceptance criterion, and every threat with `Covered by: ci` has an infra task (check this yourself; the checker only reports threats covered "by task" that no task lists); the security baseline decisions that need code (authentication, headers, rate limiting, secure token storage) are planned early, mostly within the walking skeleton or the first epic; every pipeline stage that `pipeline.md` marks as needed is covered by an `infra` task, in the order `/ci-cd` proposed (CI baseline belongs to the walking skeleton). Infra tasks follow `.claude/skills/ci-cd/references/github-actions.md`, including its validation ladder in their TDD plan.

Report gaps, show the epic list, and get approval.

## Step 3 — Stories

For each epic, write user stories in `docs/backlog/E-xx-<slug>/S-xx-yy-<slug>/story.md` from `templates/story.md`: "As <persona>, I want <action>, so that <outcome>", business acceptance criteria in Given/When/Then, linked `F-xx` and `SC-xx`.

You may outline stories for all epics, but plan **tasks one epic at a time**, starting with the first. Later epics get tasks when they become next, because earlier work changes them. Each later epic starts again at Step 1.

## Step 4 — Tasks

For the current epic, write tasks from `templates/task.md` (read it now) as `T-NNN-<slug>.md` inside the story folder. Task IDs are global and sequential (`T-001`, `T-002`, …).

1. **First task of the first epic: walking skeleton** (greenfield only; brownfield follows "Brownfield rules" below). The smallest end-to-end path through every layer (for example: database reachable, one backend endpoint, web and mobile showing its response), test runners for each level, linters, formatters and the code-quality checks (duplication, complexity, dependency rules) from `CODING_STANDARDS.md`, CI with the quality gates from `testing-strategy.md`, and a deploy to the first non-local environment if the architecture defines one. It also fills in "Where the code lives" and "Commands" in every layer guide (`docs/architecture/layers/`) with real paths and commands that work; its acceptance criteria say so. `depends_on: []`.
2. **Prefactoring before features** when existing code must change first.
3. Fill every section of the template:
   - **TDD plan:** test seams (default seams from `testing-strategy.md` unless the task needs others), ordered list of tests, level and tool for each, run command.
   - **QA plan:** edge cases from business rules, design states to check (empty, loading, error, success, no permission), platforms and devices, accessibility and security points.
   - **UI tasks:** the TDD plan includes the automated accessibility checks from `testing-strategy.md` for every screen state the task touches, and the acceptance criteria name the screen's accessibility points from its spec (e.g. "focus moves to the new item after adding", "errors are announced").
4. Every task that touches user data, permissions or input from outside lists the relevant threats in `threats:` and has a negative acceptance criterion for each (see `.claude/skills/tech-architecture/references/security-baseline.md`, "Writing security acceptance criteria"). Negative authorisation tests are mandatory for every endpoint or operation that touches user data.
4b. `layers:` uses only layer names that have a guide in `docs/architecture/layers/` (the checker verifies this).
5. `depends_on` lists only real blockers. Prefer parallelisable tasks where honest.
6. Size each task S or M. An L task must be split.

## Step 5 — Validate

Run `node scripts/backlog-check.mjs --write-index --board`. Fix every error and rerun until it prints `OK`. The generated `docs/backlog/index.md` shows the dependency graph and the tasks ready to start. `docs/backlog/board.html` is the same state as a visual board: epic progress and stage, review verdicts, a kanban with filters by epic and layer, a dependency graph per epic, fix tasks and questions waiting for the user. It is one self-contained file; tell the user to open it in a browser. Add `--lang pl` when the user writes Polish (board labels exist in English and Polish).

## Step 6 — Review with the user

Present the epic's tasks as a numbered list with "depends on" for each. Ask the user to check, task by task: *what can I demonstrate when this is done?* A task without an answer is a horizontal slice; re-cut it. Merge tasks that are too small, split ones that are too big. Apply changes, rerun the checker, and get explicit approval. On approval set `approved: <date>` in the epic's frontmatter.

On approval, tell the user the two ways to build: `/build-epic` (automated: implementer and QA subagents, stops for decisions) or manually `/implement-task` (fresh session) → `/qa-task` (another fresh session) → repeat. `/implement-task` picks the first ready task when no ID is given.

## Brownfield rules

If the BRD has `profile: brownfield`:

1. **No walking skeleton**: the product exists. Read `docs/architecture/baseline.md` instead. If it says `runnable: no` or `partial`, the first safety-net task is "make it runnable" (documented local setup, the commands in the layer guides work); nothing else can start before it.
1b. **Refresh the baseline** at the start of each change's planning: rerun its commands with the user's permission, update the failure lists, `measured` and `commit`, and commit the update.
2. **Safety net first.** Before the feature tasks of an epic, plan tasks for the areas the epic changes:
   - **characterisation tests** that pin current behaviour at a seam (they pass on today's code and fail if behaviour changes),
   - **prefactoring** to create a seam where the baseline says there is none (behaviour unchanged, proven by the characterisation tests),
   - **missing CI gates** from the `/ci-cd` audit that protect these areas,
   - a **test harness** task first if the touched area has no test runner at the needed level,
   - a **new-layer skeleton** task when the change adds a layer that does not exist yet (fills that layer guide's paths and commands, like the greenfield walking skeleton).
   Feature tasks depend on the safety-net tasks of the code they touch.
3. **No unrelated clean-up.** Debt, pre-existing test failures and inconsistencies outside the change are listed as candidates for the user, not planned silently.
4. **Existing code may be referenced.** Task "Context" may point to existing files and modules (from layer guides or the baseline); this is an exception to the "no file paths" rule.
5. **Regression in every QA plan:** the existing journeys and `F-xx` (as-is) that the task touches.
6. **Data changes** to existing data are backward compatible (expand/contract), with a rollback note.

## Change requests

When the user changes the BRD, design or architecture after tasks exist (run `/plan-backlog` and say what changed):

1. Find affected items: search task, story and epic frontmatter for the changed `F-xx`, `SC-xx` or `N-xx` IDs.
2. Show an impact list: tasks to edit (`todo`), tasks already started or done that need rework, new tasks needed, tasks no longer needed.
3. Never edit a `done` task's scope. Rework of done work is a new task that depends on what it changes.
4. Apply only what the user approves, record the change in the BRD change log (if the BRD changed), rerun the checker.
