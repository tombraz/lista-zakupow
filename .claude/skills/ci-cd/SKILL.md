---
name: ci-cd
description: Research hosting for the chosen stack, decide environments and deployment with the user, and design a full CI/CD pipeline on GitHub Actions (quality gates, security scans, staged deploys, migrations, mobile builds, rollback, monitoring), recorded in docs/architecture/ for /plan-backlog to turn into infra tasks. Use only when the user invokes /ci-cd.
disable-model-invocation: true
---

# CI/CD: hosting research and pipeline design

You decide with the user **where** the product runs and **how** code gets from a pull request to production. You write decisions, not workflows: the workflows are built later as `infra` tasks through `/plan-backlog` → `/implement-task` → `/qa-task`, following `references/github-actions.md`.

Converse and write all documents in the language the user writes in.

## Preconditions

1. `docs/architecture/tech-stack.md` and `architecture.md` have `status: approved` (run `/tech-architecture` first).
2. If `docs/architecture/deployment.md` or `pipeline.md` exists, read them and continue from the first one not approved. Never overwrite approved decisions unless the user asks.

## Hard rules

- **Research, don't recall.** Hosting offers, prices, free tiers and regions change often. Every claim about a provider comes from a page you opened in this session, cited with its URL and the date. If you cannot browse, say so, mark every provider fact as unverified, and ask the user to check prices before deciding.
- **The user decides.** You compare and recommend with honest trade-offs; the user chooses. Record each choice; write an ADR for hosting and for anything hard to reverse.
- **Simplest setup that meets the BRD.** Every environment, service and tool must trace to a requirement (`N-xx`) or a stated constraint. Name speculative infrastructure and recommend against it.
- **Ask about technology every time.** Confirm the stack from `tech-stack.md` with the user before researching; it may have changed.

## Context hygiene

Research reads many pages. Run each component's research in a subagent when subagents are available, and keep only its comparison table and sources. Decisions live in files; if the session grows long, offer to continue in a fresh session.

## Audit mode (brownfield)

This check runs **before** the preconditions' resume rule. If the BRD has `profile: brownfield`, its `change:` is `C-NN`, and your documents (`deployment.md`, `pipeline.md` and `layers/infra.md`) carry an older `change:` value, start the change: set their `status: draft` and `change: C-NN`. When the stage needs no changes for this change, still review with the user, add a change-log line "C-NN: no changes needed", and approve. Every edit gets a dated change-log line with the change ID at the end of the document.

If `pipeline.md` has `source: discovered` (written by `/adopt-codebase`), audit instead of designing from scratch:

1. Show the 12 stages with their current state (present, partial, missing) and the risks from `docs/architecture/baseline.md`.
2. Ask whether hosting stays as it is. Research hosting (Step 2) only for components the user wants to move or that are missing.
3. For each missing or partial stage, propose the smallest fix, ordered by risk (what could break production or leak data first).
4. Steps 4–6 as usual; in Step 5, gaps that protect the areas being changed come first, because `/plan-backlog` puts them in the safety net.

## Step 1 — Constraints (one round of questions)

Show the stack summary, then ask, each with your recommendation:

- monthly budget per environment, and whether free tiers are acceptable for staging,
- data residency (e.g. EU-only hosting for personal data of EU users) and compliance needs from the BRD,
- expected load at launch and in a year (users, requests, data size), from the BRD if stated,
- operations capacity: who fixes production at 2 a.m.; managed services vs self-managed servers,
- vendor lock-in tolerance,
- domain, email sending, file storage, scheduled jobs, real-time, push notifications (only those the BRD needs),
- mobile distribution: app stores, internal testing tracks, over-the-air updates,
- environments wanted: local, preview per pull request, staging, production (recommend the fewest that fit; previews are worth it when cheap, because the epic is reviewed, attacked and accepted there before it reaches `main`). Map the user's names if they use others (dev → local/preview, test → staging, prod → production): environments are deployment targets, never branches.

Record the answers in `docs/architecture/deployment.md` (from `templates/deployment.md`, read it now) under "Constraints".

## Step 2 — Research hosting per component

Follow `references/hosting-research.md` (read it now). For each component (backend, database, web, mobile build and distribution, file storage, email, monitoring, plus anything the BRD needs):

1. pick 3–4 candidates that fit the stack and constraints (include at least one managed platform and one more portable option, such as containers),
2. compare them on the criteria in the reference, with sources and dates,
3. state your recommendation and the main reason, plus when the runner-up would be better.

Present one table per component. Point out combinations: one provider for everything is simpler; mixing providers can be cheaper or more portable. Then let the user choose. Record choices in `deployment.md` and write `docs/adr/NNNN-hosting.md`.

## Step 3 — Design the pipeline

Write `docs/architecture/pipeline.md` from `templates/pipeline.md` (read it now). It must cover every stage below; for each, either the decision or "not needed because …":

1. **Triggers and branches:** follow `## Git workflow` in `tech-stack.md` (rules: `.claude/skills/tech-architecture/references/git-workflow.md`): CI on every pull request including drafts and on pushes to `main`; no branches per environment, environments are promotion steps of one build; merge commits; branch protection on `main` (PR only, required check `ci-ok`, no force push or deletion). Say whether the hosting offers preview environments per pull request; they decide where security review and UAT run.
2. **Continuous integration (every pull request):** install with caching, format and lint, type check, code-quality checks from `CODING_STANDARDS.md` (duplication, complexity, dependency rules), unit tests, integration tests with real services (e.g. a database container), build, end-to-end tests for critical journeys (with the accessibility scans from `testing-strategy.md`), migration check against an empty database, `node scripts/backlog-check.mjs`, `node scripts/design-check.mjs --scan <UI source dirs>` when the product has a UI, coverage report. In a monorepo, run only the jobs of changed layers, with one aggregate required check.
3. **Security and supply chain:** dependency vulnerability scanning with a blocking threshold and automated update pull requests, secret scanning (GitHub's secret scanning and push protection where available, or a scanner in CI), static analysis, container image scanning if images are built, a dynamic scan (DAST) of staging after each deploy, pinned third-party actions, least-privilege workflow permissions, and a `SECURITY.md` with how to report a vulnerability. Every threat in `threat-model.md` with `Covered by: ci` must map to one of these checks.
4. **Build once, deploy many:** build artifacts or images once, version them (commit SHA or semantic version), deploy the same artifact to every environment.
5. **Database migrations:** when they run relative to the app rollout, backward-compatible (expand/contract) rule, backups before production migrations, what happens on failure.
6. **Continuous delivery:** automatic deploy to staging after merge; smoke tests; production deploy with an explicit human approval; preview environments if chosen.
7. **Mobile:** build profiles per environment, internal testing distribution, store submission, over-the-air updates if used, version and build numbers.
8. **Secrets and access:** where each secret lives (environment-scoped secrets), short-lived cloud credentials (OIDC) where the provider supports them, who can approve production.
9. **Release management:** versioning, tags, changelog or release notes.
10. **Rollback:** how to return to the previous version for each component, and the target time to do it.
11. **After deploy:** health checks, error tracking, uptime alerts, log retention, backups and a tested restore.
12. **Cost control:** budgets or alerts per environment, cleanup of preview environments.

Include a Mermaid diagram of the flow from pull request to production.

## Step 3b — Local command guard

For each command-line tool of the chosen hosting and database that can deploy, migrate, delete or change production (for example a provider CLI's deploy command, a migration command run against a production URL, a command that sets production secrets), add an **ask** rule to `.claude/settings.json` in the exact form `Bash(<tool> <subcommand> *)`, so no agent can run it without the user's confirmation, in any permission mode. Production goes out through the pipeline with its approval step, not from a local session. If `.claude/settings.json` does not exist yet, create it from `.claude/skills/plan-backlog/templates/claude-settings.json` (or under `~/.claude/skills/`) first. Never add allow rules here. List the added rules in `pipeline.md` under "Secrets and access".

## Step 4 — Infra layer guide

Make sure `docs/architecture/layers/infra.md` exists (create it from `.claude/skills/tech-architecture/templates/layer.md` if missing). Fill in: providers chosen, environments, where workflows live (`.github/workflows/`), the rule that every workflow follows `.claude/skills/ci-cd/references/github-actions.md` (or `~/.claude/skills/ci-cd/references/github-actions.md`), how to validate workflows locally (`actionlint`), and how infra tasks are verified (see the reference).

## Step 5 — Hand over to planning

List the infra work as candidate tasks for `/plan-backlog`, in dependency order, each with what can be demonstrated. Typical order:

1. CI baseline (part of the walking skeleton): lint, type check, tests, build, required checks.
2. Security scans (SAST, dependencies, secrets, images), dependency updates, `SECURITY.md`, and the CI checks for threats covered by `ci`.
3. Staging deploy with smoke tests (and migrations), followed by the DAST scan.
4. Production deploy with approval and rollback.
5. Mobile build and internal distribution.
6. Monitoring, alerts, backups and restore test.
7. Release automation.

Do not create task files yourself; `/plan-backlog` does that.

## Step 6 — Approval

Present a summary: chosen hosting with monthly cost estimate per environment (with sources and date), the pipeline in one diagram, open questions, and your honest view of the weakest point (cost, lock-in, single point of failure, manual steps). On explicit approval, set `status: approved` and `approved: <date>` in `deployment.md`, `pipeline.md` and `layers/infra.md`, and tell the user the next step is `/plan-backlog`.
