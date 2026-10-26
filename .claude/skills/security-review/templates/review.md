---
scope: <E-xx | vX.Y.Z | T-NNN>
date: YYYY-MM-DD
commit: <short sha reviewed>
asvs_level: <1 | 2 | 3>
environment: <local | staging>
---

# Security review: <scope>

Verdict: <pass | fail>

> AI review of common weaknesses. Not a penetration test or professional audit. <Recommendation for an external review, if the product is high-risk.>

## Summary

<Three sentences: what was reviewed, the most serious finding, overall state.>

## Threat coverage

| Threat | Covered by | Verification found | Exploit attempt | Result |
| --- | --- | --- | --- | --- |

## Findings

| # | Severity | Area | Finding | Evidence | Threat | Proposed fix |
| --- | --- | --- | --- | --- | --- | --- |

## Exploit attempts

| # | Target | As | Attempt | Expected | Actual |
| --- | --- | --- | --- | --- | --- |

## New threats proposed

| Proposed ID | Threat | Mitigation | Verification |
| --- | --- | --- | --- |

## Proposals (prevent the class)

- <lint rule, CI check, layer guide security rule>

## Fix tasks created

- <T-NNN — finding #>
