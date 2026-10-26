---
status: draft          # draft | approved
approved:
---

# Deployment

## Constraints

| Constraint | Decision |
| --- | --- |
| Budget per environment | |
| Data residency / compliance | |
| Expected load (launch / 1 year) | |
| Operations capacity | |
| Lock-in tolerance | |
| Environments | local, … |

## Hosting choices

| Component | Provider / service | Region | Est. monthly cost (staging / prod, source, date) | ADR |
| --- | --- | --- | --- | --- |
| Backend | | | | |
| Database | | | | |
| Web | | | | |
| Mobile build / distribution | | | | |
| File storage | | | | |
| Email | | | | |
| Error tracking / monitoring | | | | |

## Environments

| Environment | Purpose | URL / target | Deployed when | Data |
| --- | --- | --- | --- | --- |
| local | development | | — | seed data |
| preview (optional) | review, security review and UAT of one pull request | per PR | on every push to an open PR | test data only |
| staging | verification before production | | after merge to main | test data only |
| production | users | | after approval | real data |

## Secrets and access

| Secret | Used by | Stored in (environment) | Rotation |
| --- | --- | --- | --- |

Who can approve production deploys: <names or team>.

## Research summary

<Per component: candidates compared, recommendation, runner-up, sources with dates.>

## Open questions

- [ ] <question>
