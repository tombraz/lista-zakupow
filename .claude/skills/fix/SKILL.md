---
name: fix
description: Short path for a bug or a small change that fits one session - reproduce it with a failing test, find the root cause, fix it minimally, have it verified by an independent QA subagent, and turn the lesson into a check. Skips the BRD-to-backlog stages; redirects to them when the change is too big. Use only when the user invokes /fix.
disable-model-invocation: true
---

# Fix: bug or small change, test-first, with QA

You handle one bug or one small change end to end in this session, without the full pipeline. It is still test-first, still independently verified, and still recorded in `docs/backlog/` so the history stays complete.

Converse in the language the user writes in.

## Step 0 — Resume

If the user names an existing fix task (`/fix T-NNN`) or a file in `docs/backlog/fixes/` is `todo`, `in-progress` or `in-qa`, read it and continue from the first unfinished step instead of starting a new one. A `todo` fix task (written by `/security-review`) starts at Step 2 with its report as the intake; set it to `in-progress`.

## Step 1 — Intake

Ask for what is missing (one round):

- **What happens** (actual) and **what should happen** (expected), with steps to reproduce, environment (local, staging, production), platform, and evidence (error message, log line, screenshot).
- **Source of truth for "expected":** a BRD requirement (`F-xx`), a screen spec (`SC-xx`), an acceptance criterion of a done task, or the user's word. If "expected" contradicts the documents, say so; the user decides which is right.
- **Urgency:** production incident (users affected now) or normal.
- **Security:** is this a vulnerability (someone can read, change or break what they should not)? If yes, set `severity: high` or `incident`, add the matching `TH-xx` to `threats:` (or propose a new threat for `threat-model.md`), keep exploit details out of public places (public issues, public pull request text), and after the fix ask `/security-review` whether the same weakness exists elsewhere.

## Step 2 — Size gate (be strict)

`/fix` is for work that fits one session and needs no new product, design or architecture decision. Redirect to the full process when any of these holds:

| Signal | Redirect to |
| --- | --- |
| new feature, new screen, new user journey | `/concept-to-brd` (brownfield: change mode) |
| changes a business rule in the BRD beyond correcting an obvious mistake | `/concept-to-brd` change mode |
| new dependency, new layer, data model change that is not backward compatible | `/tech-architecture` change mode |
| touches more than one layer in a non-trivial way, or you estimate more than one session | `/plan-backlog` (change request) |

A small change that corrects a document (typo in a rule, an obviously wrong limit) is allowed: propose the exact edit to the BRD or spec, apply it only after the user agrees, and add a change-log line.

Tell the user the classification (**bug** or **small change**) and why it passes the gate.

## Step 3 — Record the fix task

1. Find the next free task ID: the highest `T-NNN` under `docs/backlog/` plus one.
2. Write `docs/backlog/fixes/T-NNN-<slug>.md` from `templates/fix.md` (read it now): `kind: fix`, `status: in-progress`, the intake facts, `layers:` from `docs/architecture/layers/`, and links to the `F-xx`, `SC-xx` or task it relates to.
3. If `scripts/backlog-check.mjs` exists, run it and fix any error in the new file.

Branch: follow the Git workflow in `docs/architecture/tech-stack.md` and the "Fixes" table in `.claude/skills/tech-architecture/references/git-workflow.md` (or under `~/.claude/skills/`): a fix task created by a review of an epic that is not merged yet goes on that epic's branch; any other fix gets `fix/T-NNN-<slug>` from `main` and a pull request; a production incident gets `hotfix/T-NNN-<slug>` from the production tag (or commit), not from a `main` that has unreleased work, and must also reach `main` through a pull request.

## Step 4 — Reproduce first (red)

Read the layer guides for the task's layers, then:

1. Write **one test at a public seam** that reproduces the problem (for a small change: one test that states the new expected behaviour). Run it. It must fail on its assertion, showing the bug.
2. If you cannot reproduce it: do not guess a fix. Record what you tried in the task, ask the user for more information, and stop if they have none. A fix you cannot reproduce cannot be verified.
3. If the bug cannot be reached from any seam, record that as a finding (missing seam), and write the test at the nearest reachable seam; mention it to QA.

Record the test name and failure message in the task's Evidence.

## Step 5 — Root cause

Find the cause before changing code. Work from evidence: narrow down with the failing test, logs and `git log`/`git blame` of the touched code (when did it break and with which task). Write the root cause in the task in two or three sentences, including **why existing tests did not catch it**.

Search for the same pattern elsewhere in the code. Other occurrences are listed in the task; fix them in this task only if they are the same root cause in the same layer and small, otherwise propose a new task.

## Step 6 — Fix (green)

1. Make the minimal change that makes the reproducing test pass. No refactoring, no unrelated clean-up.
2. Run the full test suite, type check, lint and build. In a brownfield project, compare with `docs/architecture/baseline.md` (no new failures, no new lint or type violations).
3. Check the "Regression" list in the task: the journeys and done tasks that use the changed code.
4. Commit: `T-NNN: fix <short title>` (reproducing test and fix together, or test first if the user prefers separate commits).
5. Set `status: in-qa`, run the checker, commit the task file.

## Step 7 — Independent QA

If the `task-qa` agent exists (`.claude/agents/` or `~/.claude/agents/`), run it as a subagent with the task ID only. It has a fresh context and did not see this session. Otherwise tell the user to run `/qa-task T-NNN` in a fresh session and stop here.

- `PASS` → the task is `done`. Continue with Step 8.
- `FAIL` → fix the findings test-first (a test for each finding first), commit `T-NNN: fix QA round N`, set `in-qa`, run QA again. After 3 failed rounds stop and ask the user.
- `NEEDS_USER` → relay the question, record the answer as `Answer:` under the task's `## Open question`, run QA again.

## Step 8 — Learn (prevent the class of bug)

Answer in the task: **what would have prevented this bug?** Propose to the user the cheapest durable fix, in this order of preference:

1. a check that fails automatically (lint rule, type, CI step, test at a missing seam),
2. a "Pitfalls" entry in the layer guide,
3. a line in `CODING_STANDARDS.md` (judgement rules only).

Apply only what the user accepts; larger changes become a task through `/plan-backlog`.

## Step 9 — Production incidents

If the bug affected production, also:

- deploy through the normal pipeline (staging, smoke test, approval) unless `pipeline.md` defines a hotfix path; never deploy by hand without the user's explicit request,
- if users were affected, write a short incident note in the task: impact, duration, detection, fix, prevention,
- make sure the fix also reaches the main branch if the hotfix branch started elsewhere.

## Report

End with: classification, root cause in one sentence, the reproducing test, QA verdict, the prevention you proposed, and anything the user still has to do (deploy approval, accept a prevention, follow-up tasks).
