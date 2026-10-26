# GitHub Actions: rules for infra tasks

Read this before writing or changing anything in `.github/`. It applies to every `infra` task. Commands for each layer come from `docs/architecture/layers/<layer>.md`; decisions come from `docs/architecture/deployment.md` and `pipeline.md`.

Examples live in `examples/` next to this file. They show structure, not your stack: replace commands with the ones in your layer guides.

## File layout

| File | Purpose |
| --- | --- |
| `.github/workflows/ci.yml` | every pull request and push to main: lint, types, tests, build, per changed layer; one aggregate check `ci-ok` |
| `.github/workflows/security.yml` | static analysis (e.g. CodeQL), secret scanning, image scanning, on pull requests and weekly |
| `.github/dependabot.yml` | dependency and GitHub Actions update pull requests |
| `.github/workflows/deploy.yml` | after merge: build once, deploy staging, smoke test, deploy production after approval |
| `.github/workflows/mobile.yml` | mobile builds and distribution, if there is a mobile app |
| `.github/workflows/release.yml` | tags and release notes, if chosen |
| `scripts/deploy.sh`, `scripts/smoke.sh`, … | provider-specific steps, callable locally; workflows only call them |

Keep provider logic in scripts, not in YAML. A script can be run and tested locally; a workflow step cannot.

## Security rules (mandatory)

1. **Least privilege:** set `permissions: contents: read` at the top of every workflow; grant more only on the job that needs it (e.g. `id-token: write` for OIDC, `security-events: write` for code scanning).
2. **Pin third-party actions to a full commit SHA** with the version as a comment: `uses: actions/checkout@<40-char sha> # v7.0.1`. Look up the SHA of the latest release when you write the workflow; never invent one. Dependabot keeps pins updated.
3. **Secrets** only through `secrets.*`, scoped to a GitHub Environment (`staging`, `production`). Never print them, never pass them on the command line of a tool that logs arguments.
4. **Short-lived cloud credentials (OIDC)** instead of long-lived keys when the provider supports it.
5. **Untrusted input:** never interpolate `github.event.*` text (titles, branch names, comments) directly into `run:`; pass it through `env:` and quote it.
6. **`pull_request_target`:** do not use it unless the pipeline document says why; it runs with secrets on untrusted code.
7. **Production approval:** the `production` environment requires a reviewer. Required reviewers on environments may depend on your GitHub plan for private repositories; check it. If unavailable, use a `workflow_dispatch` job with a typed confirmation input and restrict who can run it.

## Reliability rules

- `concurrency:` per workflow and ref; cancel in-progress runs for pull requests, never for deploys.
- `timeout-minutes:` on every job.
- Cache dependencies (setup actions' built-in cache or `actions/cache`).
- Monorepo: detect changed layers (e.g. `dorny/paths-filter`) and skip unaffected jobs; one aggregate job `ci-ok` that fails if any needed job failed and is the only required check. Changes to `.github/**` run everything.
- Integration tests use service containers (e.g. Postgres) with health checks, not shared external databases.
- **Build once, deploy many:** build the artifact or image once per commit, tag it with the commit SHA, deploy that exact artifact to staging and production.
- Migrations run as their own step before the new version takes traffic; backward-compatible only (expand/contract). Production: backup or snapshot first.
- After every staging deploy, a dynamic scan (e.g. OWASP ZAP baseline) runs against staging; findings above the threshold in `pipeline.md` fail the job. For ZAP, the threshold is a rules file (`.zap/rules.tsv`, each rule set to IGNORE, WARN or FAIL) committed with the workflow. Never run active scans against production.
- Every deploy ends with `scripts/smoke.sh <environment>` (health endpoint + one critical journey); a failed smoke test fails the job and triggers the documented rollback.

## Validation (how infra tasks are tested)

Workflows cannot be unit-tested like code, so infra tasks use this ladder, cheapest first. The TDD plan of an infra task lists which rungs prove each acceptance criterion.

1. **Static:** `actionlint` passes on all workflows (run locally or with the official container image `rhysd/actionlint`, pinned). This check also runs in CI (`infra` job).
2. **Scripts:** deploy and smoke scripts have tests or a dry-run mode, run locally.
3. **Real run on a pull request:** the workflow runs and the expected checks appear. For gates, prove they fail: a throwaway branch with a deliberately failing test or lint error shows a red required check and cannot be merged. Pushing branches needs the user's permission; ask through the normal question mechanism.
4. **Deploy proof:** staging deploy from main succeeds, smoke test passes, and a deliberate smoke failure triggers the documented rollback (at least once, on staging).

QA verifies infra tasks with the same ladder and records links to the workflow runs as evidence.

## Repository settings

Branch protection (required check `ci-ok`, required review, no force push), environments and their secrets are repository settings, not files. Changing them needs the user's explicit permission. Prefer generating a short script with `gh` commands, or a step-by-step checklist, that the user runs and confirms.
