---
id: T-NNN
title: <Short description of the bug or change>
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: in-progress    # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]      # names from docs/architecture/layers/
requirements: []       # F-xx the expected behaviour comes from
threats: []            # TH-xx from docs/architecture/threat-model.md this task mitigates
screens: []
related_tasks: []      # done tasks whose behaviour this touches
---

# T-NNN <Title>

## Report

- **Actual:** <what happens>
- **Expected:** <what should happen> — source: <F-xx / SC-xx / T-xxx AC / user>
- **Steps to reproduce:**
  1. <step>
- **Environment:** <local / staging / production, platform, version or commit>
- **Evidence:** <error, log line, screenshot>

## Acceptance criteria

- [ ] AC1: Given <the reproduction context>, when <action>, then <expected result>. — verified by: <reproducing test>
- [ ] AC2: No regression in: <journeys / tasks below>

## TDD plan

**Seam:** <public boundary where the bug is observable>

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | <reproduces the bug> | | | AC1 |

**Run:** `<command>`

## QA plan

- **Regression:** <journeys and related tasks that use the changed code>
- **Edge cases:** <variants of the bug input>
- **Platforms:** <where to check>

## Root cause

<Two or three sentences. Why existing tests did not catch it. Other occurrences of the same pattern.>

## Evidence

<Reproducing test: red failure message, then passing. Full suite and static checks result.>

## Prevention

<What would have prevented this; what the user accepted.>

## Incident note

<Only for production incidents: impact, duration, detection, fix, prevention.>

<!-- QA rounds are appended below by /qa-task -->
