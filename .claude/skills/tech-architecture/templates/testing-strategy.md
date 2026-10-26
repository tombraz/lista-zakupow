---
status: draft          # draft | approved
approved:
---

# Testing strategy

## Levels

| Level | Tool | Responsible for | Not responsible for | Speed target |
| --- | --- | --- | --- | --- |
| Unit | | pure domain logic | I/O | |
| Integration | | API + database through public seams | UI | |
| UI component | | component states from the design system | backend | |
| End-to-end web | | critical journeys only | edge cases | |
| End-to-end mobile | | critical journeys only | edge cases | |

## Default test seams

| Layer | Seam | Example |
| --- | --- | --- |
| Backend | HTTP API | `POST /resource` returns 201 and persists |
| Web | screen / route | form submission shows success state |
| Mobile | screen | |

Mocks only at system boundaries (external services, time, randomness). Never mock the project's own modules.

## Security tests

- Every endpoint or operation that touches user data has negative authorisation tests (another user, anonymous, lower role) at the API seam.
- Threats with `Covered by: task` are verified by tests named in the task; threats with `Covered by: ci` by checks in `pipeline.md`.
- Dynamic scan (DAST) of staging: <tool, when, blocking threshold>.

## Accessibility tests

Only if the product has a UI. Target from `docs/design/design-decisions.md`; tools and checks from `.claude/skills/brd-to-design/references/accessibility.md`.

| Platform | Automated check | At which level | Blocks merge |
| --- | --- | --- | --- |
| Web | <e.g. @axe-core/playwright scan per screen state; eslint-plugin-jsx-a11y> | end-to-end, component | yes |
| iOS | <e.g. XCUITest performAccessibilityAudit()> | UI tests | yes |
| Android | <e.g. Espresso AccessibilityChecks / Compose checks> | UI tests | yes |

- Component and screen tests find elements by role and accessible name, not by test IDs or CSS classes, wherever the platform allows.
- `node scripts/design-check.mjs` (contrast pairs, hard-coded colours) runs in CI.
- Manual checks (keyboard, screen reader, zoom/large text, reduce motion) are part of QA for every UI task.

## Test data

<Fixtures, factories, database per test run (e.g. containers), resetting state.>

## End-to-end coverage

| Journey | Web | Mobile |
| --- | --- | --- |

## CI quality gates (block merge)

- [ ] build
- [ ] type check and lint
- [ ] code-quality checks: duplication, complexity, dependency rules (thresholds in `CODING_STANDARDS.md`)
- [ ] unit and integration tests
- [ ] end-to-end tests for touched journeys, with accessibility scans
- [ ] design check (contrast pairs, hard-coded colours)
- [ ] backlog check (`node scripts/backlog-check.mjs`)

## Global definition of done

Every task inherits:

- [ ] tests written first, at agreed seams, all passing
- [ ] acceptance criteria verified with evidence
- [ ] no hard-coded design values; design tokens used
- [ ] UI: automated accessibility checks pass for every touched screen state
- [ ] no secrets or personal data in code or logs
- [ ] brownfield: no failing test outside the "Pre-existing test failures" list in `baseline.md`

After handover, `/qa-task` is a separate gate: only a QA verdict "pass" sets a task to `done`.

## QA scope beyond automation

<Exploratory focus areas, devices and browsers to check, accessibility checks.>
