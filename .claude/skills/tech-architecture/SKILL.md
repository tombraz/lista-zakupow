---
name: tech-architecture
description: Turn an approved BRD and design into a technical foundation - stack chosen with the user, architecture, data model, API outline, testing strategy, quality attributes (security, privacy, observability), coding standards and ADRs - stored in docs/architecture/. Use only when the user invokes /tech-architecture.
disable-model-invocation: true
---

# BRD + design → technical architecture

You and the user decide how the product will be built, before any task is planned. Everything lands in `docs/architecture/` and `docs/adr/`.

Converse and write all documents in the language the user writes in.

## Preconditions

1. `docs/product/BRD.md` has `status: approved`.
2. `docs/design/ia.md` and `docs/design/design-system.md` have `status: approved`, or the user states the product has no UI.
3. If `docs/architecture/` exists, read it and continue from the first document whose frontmatter is not `status: approved`. Never overwrite approved decisions without the user asking.
4. If the BRD says `ui: none`, the design documents are not required.

## Hard rules

- **Ask about technology every time.** Never reuse a stack from memory or another project without the user confirming it in this session. You may offer a previous choice as the default.
- **Recommend, then let the user decide.** Each recommendation comes with a one-line reason and the main alternative.
- **Simplest thing that meets the requirements.** Every component must trace to a BRD requirement (`F-xx`) or non-functional requirement (`N-xx`). Name and reject speculative infrastructure (microservices, queues, caches) unless a requirement needs it.
- **Only decisions the user made** go into documents. Unresolved items are listed as open questions.

## Context hygiene

Decisions live in files, not in this conversation, so a fresh session loses nothing. At the end of each phase, if the conversation has become long (many rounds, large documents read), say so and offer to continue in a fresh session with the same command; this skill resumes from the files. Never keep a stage alive just to avoid restarting.

## Change mode (brownfield)

This check runs **before** the preconditions' resume rule. If the BRD has `profile: brownfield`, its `change:` is `C-NN`, and your documents (every document in `docs/architecture/` except `baseline.md`, `deployment.md` and `pipeline.md`) carry an older `change:` value, start the change: set their `status: draft` and `change: C-NN`. When the stage needs no changes for this change, still review with the user, add a change-log line "C-NN: no changes needed", and approve. Every edit gets a dated change-log line with the change ID at the end of the document.

If the BRD has `profile: brownfield`, the architecture documents were written by `/adopt-codebase` from the code. Do not redo them:

- Step 1: show the discovered stack and ask the user to confirm it, and what (if anything) the change adds or replaces. Never re-ask the whole list.
- If `threat-model.md` does not exist yet (project adopted or planned before it was introduced), run Step 5b in full for the whole product, not only the change.
- Steps 2–6b: update only the parts the change touches (new modules, entities, endpoints, test levels, layer guides, conventions), each with a dated entry under a "Change log" heading at the end of the document.
- Step 7: ADRs for the new decisions.
- Step 8: approval as usual; next step `/ci-cd` in audit mode.

## Step 1 — Technology (ask now, every run)

Every document this skill writes in `docs/architecture/` starts with frontmatter `status: draft` and `approved:` (empty).

If `tech-stack.md` already exists (resumed run), show it and ask the user to confirm or change it; do not re-ask everything. Otherwise ask in one or two rounds. Cover:

- repository layout (monorepo or separate repositories) and package manager,
- backend: language, framework, persistence/ORM,
- database and migration tool,
- web front end: framework and styling (must fit `docs/design/design-decisions.md`),
- mobile: framework and target platforms,
- authentication and authorisation approach,
- testing tools per level: unit, integration (e.g. real database in containers), end-to-end web, end-to-end mobile,
- local development environment (e.g. containers),
- environments, hosting and CI/CD: only record preferences or hard constraints here; the research and decisions happen in `/ci-cd`, the next stage,
- Git workflow: read `references/git-workflow.md` and offer its default (branch per epic with a draft pull request, merge commit, no branches per environment); propose the alternative (short task branches into `main` with feature flags) only when one of its conditions holds, and say which. Record the result in `tech-stack.md` under `## Git workflow` in the format at the end of that reference,
- error tracking, logging and product analytics tools,
- anything the BRD implies: offline mode, real-time updates, file storage, payments, notifications, search.

Record the answers in `docs/architecture/tech-stack.md` with today's date.

## Step 2 — Architecture overview

Write `docs/architecture/architecture.md` from `templates/architecture.md` (read it now):

- system context: users, the product, external systems (Mermaid),
- containers: apps, services, database, external services and how they talk (Mermaid),
- module boundaries by domain, named with the BRD glossary,
- authentication and authorisation model, mapped to BRD business rules,
- API and error-handling conventions,
- a sequence diagram (Mermaid) for each core journey `J-xx`,
- quality attributes: how each `N-xx` is met (security, privacy, availability, performance, accessibility, observability).

## Step 3 — Data model

Write `docs/architecture/data-model.md`:

- entities and relations as a Mermaid `erDiagram`, using BRD glossary names,
- key constraints and invariants from business rules,
- personal data inventory: which fields are personal data, why they are kept, retention period, how a user's data is exported and deleted (GDPR applies to users in the EU),
- migration approach.

## Step 4 — API outline

Write `docs/architecture/api.md`: the endpoints or operations the core journeys need, with request and response shapes and error cases. Keep it an outline; tasks refine it. If the stack generates clients from a contract (e.g. OpenAPI), say where the contract will live.

## Step 5 — Testing strategy

Write `docs/architecture/testing-strategy.md` from `templates/testing-strategy.md`:

- test levels, tools and what each level is responsible for,
- default test seams per layer (the public boundaries tests use),
- test data and database handling,
- which journeys get end-to-end tests (only critical ones),
- accessibility tests per platform (tools from `.claude/skills/brd-to-design/references/accessibility.md`; ask the user to confirm them with the other testing tools), only if the product has a UI,
- CI quality gates that block a merge,
- the global definition of done every task inherits,
- what QA checks in addition to automated tests.

## Step 5b — Threat model and security baseline

Read `references/security-baseline.md` (next to this skill) now.

1. Propose the OWASP ASVS 5.0 level from the BRD's data classification and misuse cases (usually 1; 2 when other people's personal data or private content is stored; 3 for high-risk domains). The user decides.
2. Write `docs/architecture/threat-model.md` from `templates/threat-model.md`: assets and classes, actors, trust boundaries (Mermaid), and threats per core journey and boundary using STRIDE, including every BRD misuse case `MC-xx`. Each threat gets an ID `TH-xx`, a mitigation, how it is verified, and how it will be covered (`task`, `ci` or `accepted`).
3. Fill in the security baseline decisions table with the user. Never accept home-made authentication, password storage or cryptography; recommend a proven library or provider. Write ADRs for authentication and token storage.
4. Risks the user accepts go to "Accepted risks" with reason and date. Do not accept risks on the user's behalf.
5. For high-risk domains, record in "Professional review" whether an external audit or penetration test is planned. Say plainly that this process does not replace one.

## Step 6 — Layer guides

Agree with the user on the list of layers (typically `db`, `backend`, `web`, `mobile`, and `infra` for CI/CD and deployment; `/ci-cd` completes the `infra` guide). These names are the only values tasks may use in their `layers:` field.

For each layer write `docs/architecture/layers/<layer>.md` from `templates/layer.md` (read it now): purpose, technology, testing in this layer, conventions, **security rules for this layer** (from the security baseline decisions, e.g. token storage for mobile, headers for web, authorisation pattern for backend), pitfalls, and the technology skills to use. Leave "Where the code lives" and "Commands" as placeholders when the code does not exist yet; the walking-skeleton task fills them in.

Keep each guide short. An implementer working on a task reads only the guides for the task's layers, so anything every layer needs belongs in `CODING_STANDARDS.md` instead.

## Step 6b — Coding standards

Write `docs/architecture/CODING_STANDARDS.md` with two parts:

1. **Enforced by tools:** the linters, formatters and type-check settings, plus the code-quality checks from `references/code-quality.md` (read it now): duplicate-code detection with a threshold, complexity and size limits, dependency-direction rules between modules (the domain does not import infrastructure), strict type checking. Pick concrete tools for the chosen stack **with the user** and record thresholds; they are configured in the first task and run in CI, not described in prose.
2. **Judgement rules:** only rules a tool cannot check: naming from the glossary, module boundaries and which module owns which responsibility, error handling, and the principles in practical form from `references/code-quality.md` (single responsibility, dependency inversion at system boundaries, DRY as "one place per piece of knowledge" with the rule of three, and the over-engineering limits: YAGNI, no wrong abstractions). Keep it short and concrete. Delete any rule that says nothing ("write clean code", "follow SOLID").

## Step 7 — ADRs

For every decision that is hard to reverse, surprising without context, or a real trade-off, write `docs/adr/NNNN-<slug>.md`: context, decision, alternatives considered, consequences.

## Step 8 — Review and approval

Present a summary: stack, components, data entities, open questions, risks (with your honest view of where the architecture is weakest). Apply changes. On explicit approval, set `status: approved` and `approved: <date>` in the frontmatter of every document in `docs/architecture/` (`tech-stack.md`, `architecture.md`, `data-model.md`, `api.md`, `testing-strategy.md`, `threat-model.md`, `CODING_STANDARDS.md`, `layers/*.md`), and tell the user the next step is `/ci-cd` (hosting research and pipeline design).
