---
name: review-change
description: Independent code review of any change - a branch, a pull request, a commit range or a whole epic - on two separate axes (standards - is it built right; spec - is it the right thing), plus cross-task consistency for an epic. Reports findings with citations; never fixes. Use only when the user invokes /review-change, optionally with a scope.
disable-model-invocation: true
---

# Review a change

You review code you did not write and report what you find. You do not fix anything. Each axis runs in its own subagent so one verdict cannot hide another: code can follow every convention and still do the wrong thing, or do the right thing badly.

Converse and write reports in the language the user writes in.

## Step 1 — Scope

From the argument, or ask:

| Argument | Scope | Diff |
| --- | --- | --- |
| `E-xx` | an epic | commits whose messages start with the epic's task IDs, plus the fix tasks listed under "Fix tasks created" in earlier reviews of this epic |
| `T-NNN` | one task | commits starting `T-NNN: ` (excluding QA-round commits) |
| a branch name or `main..HEAD` | a branch or range | `git diff <base>...<head>` |
| a pull request number | a pull request | its diff (via `gh pr diff` if available, otherwise ask for the branch) |

Check that the range resolves and the diff is not empty before starting anything. Only committed changes are reviewed; if the working tree has uncommitted changes in scope, say so and ask the user to commit first.

Run in a fresh session, not in a session that wrote the code.

## Step 2 — Gather the contract (paths only)

Collect the **paths** each subagent needs; do not read the documents yourself:

- **Standards:** `docs/architecture/CODING_STANDARDS.md`, the layer guides in `docs/architecture/layers/` for the layers the diff touches, `docs/architecture/architecture.md`, ADRs in `docs/adr/`, the BRD glossary. If the project has none of these, the standards axis uses the baseline below only and the report says so.
- **Design check:** if `scripts/design-check.mjs` exists and the diff touches UI code, run it yourself: `node scripts/design-check.mjs --scan <UI source dirs touched> --allow <generated token output path, from "Platform notes" in docs/design/design-system.md>`. Keep only the `HARD-CODED` lines for files in the diff, plus any `ERROR` lines; give them to the standards axis. This output is short; it is the one tool result you read.
- **Spec:** for tasks and epics, the task files, stories, linked `F-xx` in `docs/product/BRD.md` and `SC-xx` screen specs. For a branch or pull request, the pull request description or a description from the user. With no spec at all, skip this axis and write "no spec available" in the report; never infer requirements from the code.

## Step 3 — Run the axes in separate subagents

Start each subagent with: the diff range, the list of paths from Step 2, the instructions for its axis below, and this line: "Do not invoke skills or start other agents. Do not change any file. Return findings only, each with a citation."

**Standards axis** (is it built right?)
- Breaches of documented rules: cite the file and the rule.
- Layer guide rules, including "Security rules"; architecture and ADR violations (module boundaries, dependencies in the wrong direction, decisions reversed without an ADR).
- Naming that contradicts the BRD glossary.
- Principles from `.claude/skills/tech-architecture/references/code-quality.md` (or under `~/.claude/skills/`) as review questions: single responsibility, duplicated knowledge (DRY: the same rule in two places; look-alike code that changes for different reasons is not duplication), dependency direction, interface promises (Liskov), and over-engineering (YAGNI, wrong abstractions with flag parameters), which counts as a finding too. Name the principle in the "Rule or smell" column.
- Code smells as **heuristics, not violations**: unclear names, duplicated logic, a function doing several unrelated things, a change that forces edits in many places, a module reaching into another's internals, long parameter lists of values that belong together, speculative generality (code for cases nobody asked for), dead code. Each with the hunk and a one-line fix.
- Tests: do they test behaviour at public seams, or implementation details? Are expected values independent of the implementation?
- Design: each `HARD-CODED` line from the design check in a file of the diff is a **major** finding (values must come from `docs/design/tokens.json`); also look for hard-coded font sizes, spacing and radii the script cannot see, and for platform token files that are edited by hand instead of generated from `tokens.json`.
- Accessibility in UI code: the "Build" table of `.claude/skills/brd-to-design/references/accessibility.md` (native elements, roles and names, keyboard, focus management, labels and `autocomplete`, announced status messages); accessibility checks disabled in tests without a reason. Each violation is a **major** finding with the criterion number.
- Skip anything a configured linter, formatter or type checker already enforces.

**Spec axis** (is it the right thing?)
- Each acceptance criterion and requirement: implemented, partial, missing, or implemented wrongly. Cite the line of the spec.
- Scope creep: behaviour the spec did not ask for.
- Screen states from the specs (empty, loading, error, success, no permission) present where the diff touches a screen.

**Consistency axis** (only for an epic)
- The same problem solved in different ways across tasks (error handling, validation, data fetching, naming).
- Duplication across tasks or layers that should be one module.
- Drift from `architecture.md` and ADRs accumulated over the epic.
- Test suite health for the epic: skipped tests, very slow tests, tests that depend on order.

## Step 4 — Verify before reporting

Subagent findings are hypotheses. For each finding you keep, open the cited location and confirm it says what the finding claims. Drop findings you cannot confirm; correct wrong citations. Keep the axes separate: do not merge or re-rank them into one verdict.

## Step 5 — Report

Write `docs/reviews/<scope>-<YYYY-MM-DD>-<N>.md` from `templates/report.md` (read it now). First line under the title: `Verdict: pass` or `Verdict: fail`.

Severity: **blocker** (a requirement is missing or wrong, a documented rule with real impact is broken, data could be corrupted), **major** (wrong behaviour outside the criteria, architecture drift that will spread, tests that would not catch a regression), **minor** (naming, small duplication, smells), **note**.

- **Fail** when either axis has a blocker or major finding.
- End with the worst finding **per axis**, not one overall winner.
- Do not run the review again in a loop until it is clean; judgement findings change from run to run. Act on findings with a cited rule or spec line, then stop.

## Step 6 — Hand off

- **Epic or task scope:** propose a fix task for each blocker and major finding (and minor ones the user picks). After the user approves the list, write each as `docs/backlog/fixes/T-NNN-<slug>.md` from `.claude/skills/fix/templates/fix.md` (or under `~/.claude/skills/`) with `status: todo` and the finding as its report. Tell the user to run `/fix T-NNN` for each in a fresh session, then `/review-change E-xx` again.
- **Branch or pull request scope:** findings go back to the author; offer to write the review as pull request comments only if the user asks.
- **Repeated patterns:** propose a durable fix (a lint rule, a CI check, a line in a layer guide or `CODING_STANDARDS.md`); apply only what the user accepts.

Commit the report (`<scope>: code review`). For an epic, tell the user the next step: fix tasks if any (they go on the epic's branch), otherwise `/security-review E-xx`. In a Git workflow without preview environments, a pass is also the moment to merge the epic's pull request (the user merges; staging then gets the code for the security review and UAT, and production approval waits for both).
