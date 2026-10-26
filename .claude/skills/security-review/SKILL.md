---
name: security-review
description: Independent security review of a finished epic (or a release, or a range of commits) against the threat model and the chosen OWASP ASVS level, before user acceptance - verifies mitigations by trying to exploit them, reviews the code for common weaknesses, and turns findings into fix tasks. Use only when the user invokes /security-review, optionally with an epic ID.
disable-model-invocation: true
---

# Security review

You review security **across** a whole epic, where per-task QA cannot see it: how tasks combine, whether every threat is really mitigated, and whether new threats appeared. You report; you do not fix.

Converse and write reports in the language the user writes in.

## Independence and scope

- Run in a fresh session, not in a session that wrote the code. If subagents are available, run each review area below in its own subagent and keep only their findings.
- Scope, from the user's argument: an epic (`/security-review E-02`, default: the epic in `in-uat`, or the last one with all stories `done`), a release (`/security-review v1.2.0`), or a fix (`/security-review T-NNN`: same weakness elsewhere?).
- **Re-reviews of an epic always use the epic scope**, so the UAT gate sees them. An epic review covers the epic's tasks **and** the fix tasks listed under "Fix tasks created" in its earlier reviews.
- Find the code in scope: commits whose messages start with those task IDs (`git log --grep "^T-NNN: "`), and the files they touch.

## What this does not replace

Say this once at the start of the report: an AI review finds many common weaknesses, but it is not a penetration test or a professional audit. For high-risk products (see the BRD's "Security and misuse" and the threat model's "Professional review") recommend one.

Run it after `/review-change E-xx` has passed, so general quality findings are already fixed and this review can focus on security.

## Step 1 — Load the security contract

Read: the BRD section "Security and misuse", `docs/architecture/threat-model.md` (threats, baseline decisions, ASVS level, accepted risks), the layer guides' "Security rules", `.claude/skills/tech-architecture/references/security-baseline.md`, and the tasks in scope (their `threats:`, acceptance criteria and QA rounds). For ASVS requirements, read the official OWASP ASVS 5.0 for the chosen level; do not quote requirement IDs from memory.

## Step 2 — Threat coverage

Run `node scripts/backlog-check.mjs` and note threat warnings. For every threat touched by the scope:

| Check | Finding if it fails |
| --- | --- |
| a task lists it, or a CI check covers it, or it is accepted with reason | uncovered threat |
| the negative test exists, runs, and asserts refusal **and** absence of data | weak or missing verification |
| exploiting it against the running system fails (Step 3) | exploitable threat |

## Step 3 — Try to break it (running system)

Use the epic's pull-request preview environment, or staging in a workflow without previews (after the merge, before production approval), or local; never production. With at least two accounts and an anonymous client:

- **Authorisation:** for every endpoint or screen in scope that reads or changes user data, try it as another user, anonymous, and a lower role; try changing IDs in URLs and bodies; check list endpoints do not leak other users' items.
- **Authentication and sessions:** brute-force protection, password reset flow, logout invalidation, token storage on each platform (mobile secure storage, web cookie flags).
- **Input:** oversized, malformed and hostile input on every new input field and parameter; file uploads if any.
- **Abuse:** the BRD misuse cases `MC-xx`: can invitations, sharing or sign-up be abused (spam, enumeration)? Are rate limits in place where the threat model says?
- **Exposure:** error messages, logs and responses do not leak stack traces, secrets or other users' personal data; security headers and CORS as decided.

Record each attempt and its result (request, response status, what was returned). Never use real users' data.

## Step 4 — Code review for weaknesses

Review the diff in scope for: missing or inconsistent authorisation checks (especially new endpoints that skip the common pattern), string-built queries, unsafe deserialisation, raw HTML rendering, server-side requests to user-supplied URLs, secrets in code or config, weak crypto or home-made auth, verbose logging of personal data, mobile secrets in the bundle, insecure defaults in configuration. Check new dependencies against the dependency policy.

If specialised security skills are installed (for example Trail of Bits skills such as `differential-review` or `insecure-defaults`), you may use them for this step; cite their findings with evidence.

## Step 5 — New threats

List threats the epic introduced that the threat model does not have (new data, new endpoint types, new integrations). Propose them as `TH-xx` rows with mitigation and verification. They are added to `threat-model.md` only after the user agrees.

## Step 6 — Report

Write `docs/security/reviews/<scope>-<YYYY-MM-DD>-<N>.md` (N = 1, 2, … for several reviews of the same scope on the same day) from `templates/review.md` (read it now). The latest file for an epic is the one the UAT gate reads. First line under the title: `Verdict: pass` or `Verdict: fail`.

Severity: **critical** (data of other users readable or changeable, account takeover, remote code execution, secret exposure), **high** (exploitable with effort, missing mitigation for a listed threat), **medium** (weak verification, defence-in-depth gap), **low** (hardening), **info**.

- **Fail** when any critical or high finding exists. The epic must not pass UAT until they are fixed.
- For each critical, high and (if the user agrees) medium finding, propose a fix task. After the user approves the list, **write** each one as `docs/backlog/fixes/T-NNN-<slug>.md` from `.claude/skills/fix/templates/fix.md` (or under `~/.claude/skills/`) with `status: todo`, `severity: high` or `incident`, the matching `TH-xx` in `threats:` and the finding as the report. Do not implement them. Tell the user to run `/fix T-NNN` for each, in a fresh session.
- **Exploit details:** if the repository is private, keep them in the report. If it is public (or you cannot tell), do not commit exploit steps before the fix is released: write only the finding and severity in the report, give the details to the user in this conversation, and recommend a private security advisory.
- Repeated weakness patterns become proposals: a lint rule, a CI check, a "Security rules" line in a layer guide.

Commit the report and fix task files (`<scope>: security review`). Tell the user the verdict and the next step: `/fix T-NNN` for each fix task, then `/security-review E-xx` again; on pass, UAT with `/qa-task E-xx`.
