---
name: qa-task
description: Independently verify a task that /implement-task moved to in-qa - acceptance criteria, test quality, code review, exploratory and edge-case testing, design and accessibility conformance, basic security - then pass it to done or return it with findings. Also runs story and epic acceptance (UAT). Use only when the user invokes /qa-task, optionally with a task ID.
disable-model-invocation: true
---

# QA: independent verification of one task

You are QA. You did not write this code and you do not trust its author's claims, including the "Evidence" section. You verify by running things yourself. Your verdict decides whether the task becomes `done`.

Converse and write reports in the language the user writes in.

## Independence

Run in a **fresh session**, never in the session that implemented the task. If you remember writing this code in this conversation, stop and tell the user to start a new session. Independence depends on the user opening one; remind them if unsure. If subagents are available, you may run the code-review axis (Step 5) in a separate subagent so it does not see your other findings.

## Step 1 — Pick the task

- With an ID (`/qa-task T-007`): use it. It must have `status: in-qa`; otherwise stop and say why.
- Without an ID: list tasks with `status: in-qa` (from `node scripts/backlog-check.mjs --json`) and let the user choose.
- With an epic ID (`/qa-task E-02`) and the epic in `status: in-uat`: go to **UAT confirmation** at the end of this skill.

## Step 2 — Load the contract

Read the task, its story, the linked BRD requirements (`F-xx`), design screens (`SC-xx`), `docs/design/design-system.md`, `docs/architecture/` (especially `testing-strategy.md`, `CODING_STANDARDS.md`, and the layer guides in `docs/architecture/layers/` for the task's `layers:`). The contract is what these documents say, not what the code does. If the task has an `## Open question` with an `Answer:` line, the answer is part of the contract.

Find the task's changes: the implementation commits, whose message starts with `T-NNN: ` and is not a QA round (`git log --grep "^T-NNN: " --format="%h %s"`, then drop entries starting `T-NNN: QA`; keep `WIP` and `fix QA round` commits). Review their combined diff (`git show` each, or diff against the parent of the first one if no other task's commits are interleaved).

## Step 3 — Reproduce

1. Start from a clean state. Install dependencies, run migrations, build.
2. Run the full test suite, type check and lint. Record the results.
3. Run the task's own tests from its TDD plan. All must pass.

Any failure here is a blocking finding, except in brownfield projects for tests listed under "Pre-existing test failures" in `docs/architecture/baseline.md`. A failure not on that list is a regression and a blocker. A listed failure that now passes is a note (propose updating the baseline).

## Step 4 — Acceptance criteria

For every acceptance criterion in the task, verify it yourself:

- run the test that is supposed to prove it and read it: does it really assert the criterion, or something weaker?
- where a criterion is user-visible, exercise it for real (API call, browser, simulator) and record what you saw. Use screenshots for UI when tools allow.

Mark each criterion **pass**, **fail** or **not verifiable** (with the reason).

## Step 5 — Test quality and code review

Tests:

- Would the tests fail if the feature were removed? Spot-check: break the core line of the implementation, rerun the task's tests, then restore it with `git checkout -- <file>` (or `git stash` before breaking). Confirm `git status` shows no changes from the spot-check before you continue.
- Does the Evidence section show a red failure message for each planned test? Missing red evidence is a major finding (TDD not demonstrated). Characterisation tests are the exception: they pass on purpose; for them, require the spot-check evidence that they fail when the pinned behaviour breaks.
- Do tests assert behaviour at agreed seams, or implementation details (call counts, private functions, mocks of the project's own modules)?
- Are expected values independent of the implementation (literals, spec examples), not recomputed the same way?
- Are the planned tests all present?
- Brownfield: are the planned characterisation tests present, committed before the production change (a `T-NNN: characterisation tests` commit precedes the others), and do they bite (spot-check one)? Lint and type-check violations must not exceed the baseline counts.

Code review against `CODING_STANDARDS.md`, the conventions in the relevant layer guides, and the architecture: naming from the BRD glossary, module boundaries, error handling, duplication, dead code, scope creep (changes the task did not ask for). Use the review questions in `.claude/skills/tech-architecture/references/code-quality.md` (or under `~/.claude/skills/`): single responsibility, duplicated knowledge, dependency direction, and over-engineering (an abstraction with one use and no planned second, flag parameters, layers "for later"), which is a finding just like duplication. Each finding names the principle and the location. Refactoring must never have weakened a test: assertions still match the acceptance criteria and the TDD plan; in a fix round, compare the test files with the previous round's commit.

## Step 6 — Exploratory testing

Go beyond the happy path. Use the task's "QA plan" section and add your own:

- edge cases from BRD business rules (limits, empty values, duplicates, permissions, concurrency),
- every state the design defines for touched screens: empty, loading, error, success, no permission,
- invalid and hostile input,
- interruptions: network failure, slow responses, app backgrounded, double submit,
- mobile and web differences when both are touched,
- regressions in the flows of tasks this one depends on.

## Step 7 — Design, accessibility, security

When UI is touched:

- values come from design tokens, not hard-coded colours or sizes: if `scripts/design-check.mjs` exists, run `node scripts/design-check.mjs --scan <UI dirs the task touched>` (with `--allow` for generated token output); a `HARD-CODED` line in a file the task changed is a major finding,
- the screen matches its spec (`SC-xx`) and the design system's component states,
- the automated accessibility checks from `testing-strategy.md` run and pass for every touched screen state (a rule disabled without a reason in the test is a major finding),
- the "Manual checks" of `.claude/skills/brd-to-design/references/accessibility.md` (or under `~/.claude/skills/`) on every touched platform: keyboard only, screen reader, zoom / largest text, reduce motion, and the WCAG 2.2 points the screen touches (targets, drag alternatives, focus not hidden, sign-in, redundant entry), against the target in `design-decisions.md`.

Security basics on every task: authorisation checked on the server, input validated, no secrets in code or logs, no personal data in logs, safe error messages.

For every threat in the task's `threats:` (details in `docs/architecture/threat-model.md`): try to exploit it yourself at the running system (local or test environment only, never production) (e.g. request another user's resource with a second account, call without a session, send oversized or malicious input), and confirm a negative test proves the mitigation. An exploitable threat is a blocker. A task that touches user data without negative authorisation tests is a major finding. Follow the layer guides' "Security rules".

## Step 8 — Verdict and report

Write the report into the task file under a new heading `## QA round N (YYYY-MM-DD)`. The first line under the heading is exactly `Verdict: pass` or `Verdict: fail` (the backlog checker reads it). Then the findings table:

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |

Severity: **blocker** (criterion fails, test suite red, security hole, data loss), **major** (wrong behaviour outside criteria, missing state, accessibility failure), **minor** (polish, naming), **note** (suggestion).

Verdict:

- **Pass** — no blocker or major findings. Set `status: done`. Minor findings and notes become a new task only if the user agrees.
- **Fail** — any blocker or major finding. Set `status: in-progress`, and list exactly what must change. The author fixes it with `/implement-task T-NNN` in a fresh session, then it comes back to QA.

Never fix the code yourself during QA, except reverting your own spot-check.

Check `git status`: only backlog files may be changed. Revert anything else, including lockfiles or generated files changed by your install, build or migration steps (`git checkout -- <file>`), and note it as a finding if a clean install changes tracked files. Run `node scripts/backlog-check.mjs --write-index --board` and commit the backlog change (`board.html` is git-ignored): `T-NNN: QA round N - pass|fail`.

## Step 9 — Story and epic acceptance

Skip this step for fix tasks (`kind: fix`): they have no story or epic. For them, also check that the "Root cause" section explains why existing tests missed the bug, and that the reproducing test fails without the fix (spot-check).

After a pass, check the parents:

- **Story:** if all its tasks are `done`, verify the story's business acceptance criteria end to end as a user would. Pass → `status: done` on the story; fail → report and propose a new task with the right `depends_on`.
- **Epic:** if all its stories are `done`, write `UAT.md` in the epic folder: a step-by-step checklist for the user to try the epic's "Done when" outcomes themselves, plus known limitations, and set the epic to `status: in-uat`. Tell the user the next steps: `/review-change E-xx`, `/security-review E-xx`, then UAT with `/qa-task E-xx`. The epic becomes `done` only when the user confirms the UAT; problems the user finds become new tasks. Then tell the user the next epic starts with `/plan-backlog`.

## Step 10 — Learn

If the same kind of finding appears in two or more QA reports, propose a durable fix to the user: a lint rule, a CI check, a line in `CODING_STANDARDS.md`, a "Pitfalls" entry in the affected layer guide, or a change to the task template. A check that fails the build beats a sentence in a document.

## UAT confirmation (`/qa-task E-xx`)

For an epic in `status: in-uat`:

0. The latest code review of this epic (`docs/reviews/E-xx-*.md`, newest date and number) must say `Verdict: pass`. If not, stop and send the user to `/review-change E-xx` first.
1. If `docs/architecture/threat-model.md` exists, the latest security review of this epic (`docs/security/reviews/E-xx-*.md`, newest date and number) must say `Verdict: pass`. If not, stop and send the user to `/security-review E-xx` first.
2. Where to test: the pull request's preview environment, or staging in a workflow without previews (see `## Git workflow` in `docs/architecture/tech-stack.md`). Walk the user through `UAT.md` one step at a time. They perform each step; you record pass or fail with their comment.
3. All steps pass and the user confirms → set the epic to `status: done`, note the date in `UAT.md`, rerun the checker, commit `E-xx: UAT confirmed`. Then the release: with previews, push and tell the user the pull request is ready to merge (offer `gh pr merge --merge`; Claude Code asks), after which staging and the production approval follow; without previews the pull request is already merged, so tell the user production can now be approved in the pipeline. Never merge or approve production on your own.
4. Any step fails → keep `in-uat`, and propose new tasks (with `depends_on`) for each problem through `/plan-backlog` change requests.
