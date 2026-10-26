---
title: <Product name> — Business Requirements
status: draft            # draft | approved
ui: yes                  # yes | none (no user interface: design stage is skipped)
profile: greenfield      # greenfield | brownfield (set by /adopt-codebase)
change:                  # brownfield only: current change ID, C-00 = adoption, C-01, C-02 …
version: 0.1
approved:                # YYYY-MM-DD, filled only on explicit approval
---

# <Product name> — Business Requirements

## 1. Summary

<3–5 sentences: what the product is, for whom, what problem it solves, why now.>

## 2. Problem and current workaround

<What hurts today, for whom, how people cope without this product.>

## 3. Users and personas

| Persona | Who they are | Main goal | Pays? |
| --- | --- | --- | --- |
| | | | |

## 4. Value proposition

<Why a persona chooses this over the current workaround. One paragraph.>

## 5. Core user journeys

### J-01 <Journey name>
1. <step>
2. <step>

## 6. Scope of the first release (MVP)

<One sentence describing the MVP boundary.>

## 7. Functional requirements

### F-01 <Requirement name>
- **Persona:** <who>
- **Description:** <what the user can do>
- **Origin:** new | as-is (evidence: <screen, endpoint or file>) | new in C-NN | changed in C-NN
- **Priority:** must | should | could
- **Journeys:** J-01
- **Business acceptance criteria:**
  - Given <context>, when <action>, then <observable outcome>.
- **Business rules:** <limits, permissions, edge cases>

## 8. Non-functional requirements (in business terms)

| ID | Area | Requirement |
| --- | --- | --- |
| N-01 | Platforms | |
| N-02 | Privacy / data | |
| N-03 | Availability | |
| N-04 | Accessibility | <target, e.g. WCAG 2.2 AA; legal basis if any: European Accessibility Act / public sector / none / to confirm with a lawyer> |
| N-05 | Languages | |

## 8b. Security and misuse

### Data classification

| Data | Class (public / internal / personal / sensitive) | Why we need it |
| --- | --- | --- |

### Misuse cases

| ID | Who | Tries to | Must not succeed because |
| --- | --- | --- | --- |
| MC-01 | another signed-in user | read someone else's private data | |

High-risk domain (payments, health, children, special categories): <yes/no; if yes, professional review planned?>

## 9. Business model

<Who pays, how much (hypothesis), when. Mark hypotheses as hypotheses.>

## 10. Success metrics

| Metric | Target | How measured |
| --- | --- | --- |

## 11. Out of scope

| Item | Reason | Revisit when |
| --- | --- | --- |

## 12. Assumptions and risks

| ID | Assumption / risk | Impact if wrong | How to test |
| --- | --- | --- | --- |
| R-01 | <riskiest assumption> | | |

## 13. Open questions

- [ ] <question> — owner, needed before <phase>

## 14. Glossary

| Term | Meaning |
| --- | --- |

## 15. Change log

| Date | Version | Change |
| --- | --- | --- |
