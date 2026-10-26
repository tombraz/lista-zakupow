---
name: implement-task
description: Implement one backlog task from docs/backlog/ strictly test-first (red-green), only after all its dependencies are done, then record evidence and hand it to QA (status in-qa), or fix findings from a failed QA round. Use only when the user invokes /implement-task, optionally with a task ID.
disable-model-invocation: true
---

# Implement one task, test-first

You implement exactly one task from `docs/backlog/`, using strict TDD, and leave the backlog in a consistent state.

Converse in the language the user writes in. Code, identifiers and commit messages follow the repository's conventions.

## Step 1 — Pick the task

- If the user gave an ID (`/implement-task T-007`), use it.
- Otherwise run `node scripts/backlog-check.mjs --next` and propose the first ready task. If several are ready, list them and let the user choose.

State the task ID and title before doing anything else, and wait for confirmation if you picked it yourself.

## Step 2 — Check it may start

1. Run `node scripts/backlog-check.mjs`. If it reports errors, stop and show them; the backlog must be fixed first.
2. Every task in `depends_on` must have `status: done`. If not, stop, name the unfinished blockers, and suggest the ready task instead. Never start a blocked task.
3. Make sure the working tree is clean and you are on the branch the Git workflow in `docs/architecture/tech-stack.md` prescribes (`## Git workflow`; rules in `.claude/skills/tech-architecture/references/git-workflow.md` (or under `~/.claude/skills/`)): in the default workflow the epic's branch from `branch:` in `epic.md` (if the epic has none yet, create it as `/build-epic` Step 1 describes); in the task-branch workflow `task/T-NNN-<slug>` from `main`. Never commit task work on `main`.

Set `status: in-progress` in the task file. If its story or epic is still `todo`, set them to `in-progress` too.

**Returned from QA:** if the task has a `## QA round N` section with verdict "fail", this run is a fix round. Work only on the blocker and major findings of the latest round. For each finding, first write a test that reproduces it (red), then fix it (green). Do not reopen anything else.

## Step 3 — Load context

Read, in this order: the task, its story, its epic, `docs/architecture/tech-stack.md` (and the epic's "Technology" section if present), `docs/architecture/testing-strategy.md`, `docs/architecture/CODING_STANDARDS.md`, the layer guides `docs/architecture/layers/<layer>.md` for **each layer in the task's `layers:` field and no others**, the BRD requirements and design screens the task links to, and relevant ADRs. For a task that touches UI, also the "Build" and "Automated tests" parts of `.claude/skills/brd-to-design/references/accessibility.md` (or under `~/.claude/skills/`). Read only what the task references.

If the task has an `## Open question` section with an `Answer:` line, that answer is the user's decision: apply it and continue.

Restate in 3–5 sentences what you will build and how it will be demonstrated.

## Step 4 — Technology check

If the task needs a library, tool or pattern that is not in `docs/architecture/tech-stack.md`, the epic's "Technology" section or an ADR, **ask the user before using it**. Offer a recommendation and an alternative. Record the decision the same way `/plan-backlog` does: project-wide changes in `tech-stack.md`, epic-only changes in the epic's "Technology" section, plus an ADR if it is hard to reverse.

## Step 5 — Confirm test seams

Read the task's "TDD plan". If the test seams are missing or unclear, propose them (start from the default seams in `testing-strategy.md`; public boundaries, as high as possible, as few as possible) and get the user's confirmation. Never write a test at a seam the user has not agreed to.

## Step 5b — Characterisation tests (brownfield)

If the task's TDD plan lists characterisation tests, write them **before** changing anything:

1. Write each test against the current behaviour. It must **pass** on the current code (it describes what exists).
2. Prove it bites: temporarily break the behaviour it pins, see it fail, restore the code (`git checkout -- <file>`), confirm `git status` shows only the new test.
3. Record each test and its spot-check result in the Evidence section.
4. Commit the characterisation tests on their own (`T-NNN: characterisation tests`) before any production change, so QA can see the order.

If a characterisation test cannot pass on today's code (the current behaviour looks like a bug, or the test is flaky), do not change production code to make it pass. Stop and ask the user whether the current behaviour is intended (autonomous mode: `NEEDS_USER`).

When an acceptance criterion intentionally changes pinned behaviour, update that characterisation test first so it fails (red), then change the code (green). Behaviour not named in the acceptance criteria must stay pinned.

## Step 6 — Red-green loop

For each test in the plan's order:

1. **Red:** write one test. If the code under test does not exist yet, add only a stub with the signature (e.g. a function that throws "not implemented", an endpoint returning 501) so the test compiles. Run it. Confirm it fails **on its assertion**, for the expected reason, not on a syntax error or missing import. Record the test name and the failure message for the Evidence section.
2. **Green:** write the minimum code that makes it pass. Run it. Confirm it passes.
3. **Refactor:** with all tests green, improve the code just written and the code it touches: remove duplicated knowledge, clarify names (BRD glossary), extract functions or modules, simplify conditionals, move logic to the module responsible for it. No behaviour change and no edits to test assertions; rerun the tests after each change. Follow "The refactor step" in `.claude/skills/tech-architecture/references/code-quality.md` (or under `~/.claude/skills/`). Do not invent abstractions for later (YAGNI).
4. Run the type check, lint and the tests of the touched area.
5. Next test.

For a task that touches UI, the accessibility checks from `testing-strategy.md` are tests like any other: write them in the loop (red first: e.g. an axe scan or a role-and-name query that fails before the markup is right), never as an afterthought.

Rules:

- Never write several tests before implementation, and never write implementation before its test.
- Expected values come from the acceptance criteria, the BRD or literal examples, never recomputed the way the code computes them.
- Mock only at system boundaries (external services, time, randomness). Never mock the project's own modules.
- Security criteria are tests like any other: for each threat in `threats:`, write the negative test (another user, anonymous, lower role, hostile input) and see it fail before writing the protection. Follow the layer guides' "Security rules".
- Slow end-to-end tests (browser, emulator) come after the behaviour works at faster seams.
- If you discover a missing behaviour that the plan did not list, add it to the plan as a new test first, then implement it.

## Step 7 — Scope guard

If the task turns out larger than planned, the acceptance criteria are wrong, or a dependency is missing:

- stop at the last green test,
- if the task cannot continue without something outside its scope, set `status: blocked` and write the reason in `blocked_reason`,
- explain the problem,
- propose a fix: split the task, add a new task with the right `depends_on`, or change criteria,
- change the backlog only after the user agrees, then rerun the checker.

Never silently expand or shrink scope.

## Step 8 — Verify

0. One refactor pass over the task's whole diff against the review questions in `.claude/skills/tech-architecture/references/code-quality.md` (or under `~/.claude/skills/`) (single responsibility, duplicated knowledge, dependency direction, over-engineering) and `CODING_STANDARDS.md`. Tests stay green.
1. Run the full test suite, type check, lint and build, including the code-quality checks from `CODING_STANDARDS.md` (duplication, complexity, dependency rules). In a brownfield project, compare with `docs/architecture/baseline.md`: no test may fail that is not in its "Pre-existing test failures" list, and lint or type-check violation counts may not rise above its "Static checks" numbers. If the baseline cannot be compared (marked "could not verify"), stop and ask the user (autonomous mode: `NEEDS_USER`).
2. Walk through every acceptance criterion. For each, give evidence: the test that proves it, or the result of the manual check (screenshot for UI when possible).
3. If anything fails, go back to Step 6. Do not claim "done" without fresh evidence from this run.

## Step 8b — Keep layer guides accurate

If you found that a path or command in a layer guide is wrong or missing, correct the "Where the code lives" or "Commands" section (facts only) and mention it in the Evidence. Changes to "Conventions" are proposals: write them in the task's Evidence for the user, do not edit them.

## Step 9 — Hand over to QA

You never mark your own task `done`. QA does.

1. Fill the task's "Evidence" section: for each test in the TDD plan, its red failure message and that it now passes; for each acceptance criterion, its proof. Tick the criteria you verified.
2. Set `status: in-qa`. Leave story and epic statuses alone.
3. Run `node scripts/backlog-check.mjs --write-index --board` and make sure it passes.
4. Commit code, tests and backlog changes together: `T-NNN: <task title>` (in a fix round: `T-NNN: fix QA round N`).
5. Report: what was built, how to demo it, and anything QA should look at closely (risky areas, decisions you made).

Tell the user the next step is `/qa-task T-NNN` in a **fresh session**. Tasks that depend on this one stay blocked until QA passes it.
