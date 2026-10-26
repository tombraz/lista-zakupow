# Hosting research method

Use this when comparing hosting options for one component (backend, database, web, mobile distribution, storage, email, monitoring).

## Sources, in order of trust

1. The provider's own pricing page, documentation and region list (open them; snippets are not enough).
2. The provider's status page and published incident history (reliability).
3. The framework's own deployment documentation (what it officially supports).
4. Independent comparisons and community reports, only as hints to verify, never as the source of a number.

Write the date next to every price. Prices and free tiers change; the user must be able to re-check.

## Criteria

Score each candidate on what matters for this product; drop criteria that don't.

| Criterion | Questions |
| --- | --- |
| Stack fit | Does it officially support this runtime and version? Any known limits (memory for JVM apps, cold starts, build time limits, server-side rendering support)? |
| Cost | Monthly estimate for staging and production at launch load, and at the one-year load from the BRD. What drives the bill up (bandwidth, seats, build minutes, idle instances)? Is there a spending cap or alert? |
| Free tier | What it includes, whether it sleeps or has limits that break a staging environment, whether it is allowed for commercial use. |
| Region and data | Available regions (e.g. EU), where backups live, data processing agreement available, compliance statements relevant to the BRD. |
| Operations | Managed or self-managed? Who patches the OS and database? Automatic backups, point-in-time restore, scaling, zero-downtime deploys, rollback. |
| CI/CD integration | Official GitHub Actions or CLI, OIDC support for short-lived credentials, preview environments. |
| Observability | Logs, metrics, alerts built in or extra. |
| Lock-in and exit | Standard containers and databases vs proprietary features; how hard it is to move away. |
| Reliability | Uptime commitments, incident history, support options. |

## Output per component

| Candidate | Fits stack | Est. cost staging / prod (source, date) | Region | Ops effort | Lock-in | Notes |
| --- | --- | --- | --- | --- | --- | --- |

Then:

- **Recommendation:** one candidate and the main reason.
- **Runner-up:** when it would be the better choice.
- **Risks:** what could make this choice painful later.
- **Sources:** list of pages opened, with dates.

## Honesty rules

- If two options are close, say so; don't manufacture a winner.
- If the cheapest option needs much more operations work, put the work in hours next to the price.
- If you could not verify a price, write "unverified" instead of a number.
- Never recommend a provider only because it is popular.
