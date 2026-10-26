---
name: build-epic
description: Run the build loop for an approved epic with a team of subagents - task-implementer builds each ready task test-first, task-qa verifies it independently, failed tasks go back with the QA report - while keeping this session's context small and stopping for every decision only the user can make. Use only when the user invokes /build-epic, optionally with an epic ID.
disable-model-invocation: true
---

# Build an epic with implementer and QA subagents

You are the **orchestrator**. You do not write code, review code or read test output. You decide which task goes to which subagent, relay decisions between the subagents and the user, and keep a log. Your context must stay small so the loop can run for many tasks.

Converse in the language the user writes in.

## Context rules (the reason this skill exists)

- Read the backlog state **only** through `node scripts/backlog-check.mjs --summary --epic E-xx`. It returns task IDs grouped by what to do next; it does not return task contents.
- Never read task bodies, code, diffs or logs. The only file contents you may read are an unanswered `## Open question` section (to relay it) and the last 20 lines of `docs/backlog/progress.md`.
- Write to files only by **appending** (shell `printf ... >> file`), never by reading and rewriting them.
- Pass subagents **only the task ID**. They read everything else themselves.
- Keep only the contract fields of each subagent answer.
- **Session budget:** stop after **5 tasks reach `done`** or **12 subagent runs**, whichever comes first, and ask the user to continue in a fresh session with `/build-epic`. A fresh session resumes from files without loss.

## Step 1 — Preconditions

1. `scripts/backlog-check.mjs` exists and `--summary` returns `"ok": true`. Otherwise stop and show the errors.
2. Choose the epic: the ID the user gave, or the first epic in `--summary` (without `--epic`) that has `approved` set and is not `done`. It must have `approved` set; otherwise send the user to `/plan-backlog`.
3. The agents `task-implementer` and `task-qa` exist (`.claude/agents/` or `~/.claude/agents/`). Otherwise stop and say which file is missing.
4. The working tree is clean (`git status --porcelain` is empty). Otherwise stop and ask the user to commit or stash.
5. Command permissions (once per project, and again when a layer guide's "Commands" change): collect the test, lint, type-check, build and end-to-end commands from the "Commands" sections of `docs/architecture/layers/*.md` (`grep -A15 "^## Commands" docs/architecture/layers/*.md`). For each command without a matching `allow` rule in `.claude/settings.json`, propose an exact, narrow rule (`Bash(pnpm test *)`, `Bash(./gradlew test *)`), never a whole runner (`Bash(pnpm *)`, `Bash(npx *)`, `Bash(docker exec *)`, `Bash(bash *)`, `Bash(sh -c *)`), because those run anything. Add the rules the user accepts (Claude Code asks before writing to `.claude/`) and commit them (`chore: command permissions`) so the working tree is clean again. In "Accept edits" or manual mode these rules are what lets the loop run without a prompt for every test run; in auto mode the loop works without them. If the user declines, continue.
6. Branch and pull request: read the workflow with `grep -i -A12 "## git workflow" docs/architecture/tech-stack.md`. If nothing is recorded, offer the default from `.claude/skills/tech-architecture/references/git-workflow.md` (or under `~/.claude/skills/`) once, append the user's choice to `tech-stack.md` in that reference's format, and commit it **before** creating the branch.
   - **Epic-branch workflow (default):** if `epic.md` has no `branch:`, create `epic/E-xx-<slug>` from an up-to-date `main`, push it (`git push -u origin <branch>`; Claude Code asks the user), open a draft pull request to `main` titled `E-xx <epic title>` with `gh pr create --draft` (if `gh` is not available, ask the user to open it and give you the link), and write `branch:` and `pr:` into `epic.md`; commit. Otherwise check out the recorded branch.
   - **Task-branch workflow:** each task gets `task/T-NNN-<slug>` from `main`, created by this loop before the implementer starts, and its own pull request after QA `pass`; this loop then works one task at a time and stops after each QA pass for the user to merge.

## Step 2 — Resume

1. Read the last 20 lines of `docs/backlog/progress.md` if it exists; otherwise create it with a one-line header and commit it.
2. Run `--summary --epic E-xx`. If `awaiting_user` is not empty, relay those questions first (Step 5) before starting the loop.
3. Tell the user in one line where the epic stands (counts).

## Step 3 — The loop

Each iteration:

1. Run `node scripts/backlog-check.mjs --summary --epic E-xx --board`. If `ok` is false, stop and show the errors. `--board` refreshes `docs/backlog/board.html` (its "Wrote" line goes to stderr; the JSON on stdout is unchanged), so the user can watch progress in a browser while the loop runs. Do not read the board yourself. Add `--lang pl` when the user writes Polish (board labels exist in English and Polish).
2. Pick the next action, in this priority order. Tasks in `awaiting_user` are never picked; they wait for the user.
   1. first ID in `in_qa` → **task-qa** subagent (QA first: it unblocks other tasks);
   2. first item in `qa_failed` with `qa_rounds` below 3 → **task-implementer** (fix round);
   3. an item in `qa_failed` with 3 or more rounds → stop (Step 4);
   4. first ID in `resumable` → **task-implementer** (answered question or interrupted run);
   5. first ID in `ready` → **task-implementer**;
   6. nothing left → stop (Step 4).
3. Run **one subagent at a time**. Tasks share one working tree; never run them in parallel.
4. Handle the result:

| Result | What you do |
| --- | --- |
| implementer `IN_QA` | log, continue (QA runs next) |
| QA `PASS` | log, continue; if `EPIC: EPIC_UAT_READY`, stop (Step 4) |
| QA `PASS` with `STORY: … FAILED` | log, stop: the story needs a new task via `/plan-backlog` (change request) |
| QA `FAIL` | log the `TOP` line, continue (fix round runs next) |
| `NEEDS_USER` (either agent) | relay the question now (Step 5), then continue |
| implementer `BLOCKED` | log, stop, show the reason, suggest `/plan-backlog` (change request) |
| implementer `FAILED` | log, stop, show the reason; the task waits in `awaiting_user` until the user answers |
| `PROPOSAL` present | collect it; show it at the next stop; never apply it yourself |

5. Append one line to `docs/backlog/progress.md`:
   `YYYY-MM-DD HH:MM | T-NNN | implementer|qa | RESULT | <one-line summary>`
   Commit progress-log changes together with any answer you recorded, so the tree stays clean.
6. Check the session budget.

## Step 4 — Stop conditions

Stop the loop and report when:

- an implementer returns `BLOCKED` or `FAILED`, or a story acceptance fails,
- a task failed QA 3 times (show its last `TOP` line; options: split it via `/plan-backlog`, give the implementer guidance as an answer, or fix it manually and run `/qa-task`),
- the epic is `in-uat`: tell the user the next steps, each in a fresh session: `/review-change E-xx` (code review of the whole epic), `/security-review E-xx`, then UAT with `/qa-task E-xx`,
- nothing is ready, in QA, failed or resumable (remaining tasks wait on the user, on other epics, or everything is done),
- the session budget is reached.

Before the stop report, in the epic-branch workflow, push the branch (the user confirms) so CI runs on the draft pull request; when the epic reached `in-uat`, also mark the pull request ready (`gh pr ready`). The stop report is at most 10 lines: tasks that reached `done` in this session, tasks waiting on the user, the stop reason, collected QA proposals, and the **one** next action. At the first stop of a session, mention that `docs/backlog/board.html` shows the whole picture.

## Step 5 — Relaying a question

1. Read only the last `## Open question` section of that task: `awk '/^## Open question/{buf=""; f=1} f{buf=buf $0 "\n"} END{printf "%s", buf}' <task file>`. The task file path comes from `node scripts/backlog-check.mjs --next` or `ls docs/backlog/*/*/T-NNN-*.md`.
2. Show the user the question, the recommendation and the alternative. Ask.
3. Record the answer by appending to the end of the task file: `printf '\nAnswer: %s\n' "<answer>" >> <task file>`. If the answer is a technology decision for the whole project or epic, also append a dated line to `docs/architecture/tech-stack.md` (project-wide) or the epic's `epic.md` (epic-only), and suggest an ADR if it is hard to reverse.
4. Commit: `T-NNN: answer from user`. The task now appears in `resumable` (implementer) or `in_qa` (QA) and the loop picks it up.

## Never

- Write or edit product code or tests.
- Mark a task `done` (only QA does) or an epic `done` (only the user's UAT does).
- Answer a subagent's question on the user's behalf.
- Run QA in the same subagent that implemented the task.
