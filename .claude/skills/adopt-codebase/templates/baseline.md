---
status: draft          # draft | approved
approved:
measured: YYYY-MM-DD
commit: <short sha>
change: C-00
scope: whole           # whole | list of adopted paths
runnable: yes          # yes | partial | no
---

# Baseline: the codebase as adopted

## Summary

<Three to five sentences: what the product is, its state, and the three biggest risks to changing it safely.>

## Commands run

| Purpose | Command | Result | Duration |
| --- | --- | --- | --- |
| install | | | |
| build | | | |
| lint | | | |
| type check | | | |
| tests | | <passed / failed / skipped> | |

## Static checks

New work may not increase these counts.

| Tool | Violations | Notes (baseline file, if the tool supports one) |
| --- | --- | --- |
| lint | | |
| type check | | |

## Pre-existing test failures

New work must not add to this list. QA treats anything not listed here as a regression.

| Test | Failure | Flaky? |
| --- | --- | --- |

## Test coverage by area

| Area / module | Tests exist (level) | Seams to test from | Notes |
| --- | --- | --- | --- |

## Change hotspots

| File or module | Changes in recent history | Tests | Risk |
| --- | --- | --- | --- |

## Risks

| ID | Risk | Evidence | Severity |
| --- | --- | --- | --- |

## Technical debt

| Item | Evidence | Impact on planned changes |
| --- | --- | --- |

## Could not verify

- [ ] <what, why, what is needed>
