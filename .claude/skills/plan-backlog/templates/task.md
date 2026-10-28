---
id: T-NNN
title: <Task name>     # wrap in quotes if the title contains " #"
epic: E-xx
story: S-xx-yy
status: todo           # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: []         # inline list only, e.g. [T-001, T-004]; only real blockers
size: S                # S | M (L must be split)
layers: [backend]      # names from docs/architecture/layers/, e.g. [db, backend, web, mobile, infra]
requirements: [F-xx]   # F-xx and/or N-xx
threats: []            # TH-xx from docs/architecture/threat-model.md this task mitigates
screens: []            # e.g. [SC-02]
---

# T-NNN <Task name>

## Goal

<What works after this task that did not work before. One or two sentences.>

## Demo

<How a person sees it working: steps and expected result.>

## Context

- BRD: F-xx — <short quote of the rule this task implements>
- Design: SC-xx, components <names>
- Depends on: <T-xxx — what it provides that this task needs>
- Existing code (brownfield): <modules or files this task changes, from layer guides or baseline>

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [ ] AC1: Given <context>, when <action>, then <result>. — verified by: <test name or manual check>
- [ ] AC2: …
- [ ] SEC1 (for each threat in `threats:`): Given <attacker context, e.g. another user>, when <attempt>, then <refused, no data>. — verified by: <negative test>

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- <e.g. HTTP API `POST /accounts`>

**Characterisation tests** (brownfield only, written first; they must pass on the current code and fail if the pinned behaviour changes):

| # | Current behaviour pinned | Seam | Framework |
| --- | --- | --- | --- |

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | <behaviour in plain words> | integration | <framework> | AC1 |
| 2 | | | | |

**Run:** `<command to run these tests>`

**Mocks:** only at system boundaries (<external service, clock>). Never mock own modules.

**Client state during writes** (UI tasks that save through the API): for each write, a component test with a delayed response (the user keeps acting meanwhile; nothing is lost silently), a lost response after the server saved (retry does not duplicate, changed input does not return the old result, the screen matches the server), and data changing meanwhile (a warning from the API expires when its cause is gone). See "Pitfalls" in the layer guide.

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases** (from BRD business rules): <limits, empty values, duplicates, permissions>
- **Design states** (touched screens): <empty, loading, error, success, no permission>
- **Platforms / devices:** <browsers, iOS, Android, screen sizes>
- **Accessibility:** <keyboard, screen reader, zoom / large text, targets, drag alternatives, focus not hidden; the manual checks in `.claude/skills/brd-to-design/references/accessibility.md`>
- **Security / privacy:** <threats TH-xx to try to exploit; authorisation with another user and anonymous; validation; no personal data in logs>
- **Regression:** <flows from dependent tasks to re-check>

## Implementation notes

<Constraints and hints, not a step-by-step recipe. No file paths unless they come from an agreed design or ADR, or (brownfield) point to existing code.>

## Definition of done

- [ ] All tests in the TDD plan written test-first and passing
- [ ] Full test suite, type check and lint pass
- [ ] Every acceptance criterion checked, with evidence below
- [ ] Global definition of done from `docs/architecture/testing-strategy.md` met
- [ ] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [ ] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

<Filled by /implement-task: test names, command output summary, screenshots for UI.>

<!-- QA rounds are appended below by /qa-task -->
