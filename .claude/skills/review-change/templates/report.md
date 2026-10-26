---
scope: <E-xx | T-NNN | branch | PR #n>
date: YYYY-MM-DD
range: <base>...<head>
axes: [standards, spec]   # add consistency for an epic; remove spec if no spec was available
---

# Code review: <scope>

Verdict: <pass | fail>

## Summary

<Three sentences: what was reviewed, the worst finding per axis, overall state.>

## Standards

| # | Severity | Finding | Rule or smell | Location | Fix |
| --- | --- | --- | --- | --- | --- |

Worst: <one line>

## Spec

<"No spec available" if skipped.>

| # | Severity | Requirement / criterion | Status (missing, partial, wrong, scope creep) | Spec line | Location |
| --- | --- | --- | --- | --- | --- |

Worst: <one line>

## Consistency (epic only)

| # | Severity | Finding | Where (tasks, files) | Suggested direction |
| --- | --- | --- | --- | --- |

Worst: <one line>

## Proposals (prevent the class)

- <lint rule, CI check, layer guide or standards line>

## Fix tasks created

- <T-NNN — finding #>
