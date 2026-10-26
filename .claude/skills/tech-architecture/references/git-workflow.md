# Git workflow

One written workflow per project, recorded by `/tech-architecture` in `docs/architecture/tech-stack.md` under `## Git workflow` (other skills find it with `grep -i -A12 "## git workflow"`). Ask the user every time; offer the default below and say when the alternative fits better.

## Principles (both variants)

- **One long-lived branch: `main`.** Protected: changes only through pull requests, required CI check (`ci-ok`), no force push, no deletion. Always deployable.
- **No branches per environment** (`dev`, `test`, `prod`). Environments are deployment targets of the same build: the pipeline builds once per commit on `main` and promotes that exact artifact (staging automatically, production after approval). Branches per environment build different code for each environment, drift apart and need hand-carried fixes.
- **Merge method: merge commit** (no squash). The task commits (`T-NNN: …`) stay in `main`'s history; QA, `/review-change` and `/security-review` find a task's code by that prefix.
- **Merges into `main` are the user's decision.** Skills prepare and recommend; `gh pr merge` always asks (rule in `.claude/settings.json`).
- **Pushing is the user's step too.** `git push` asks; skills push only at points where the user is present (start and stops of `/build-epic`, end of `/fix`).
- Releases: a tag `vX.Y.Z` on `main` per production release (details in `pipeline.md`, "Release management").

## Default: branch per epic with a draft pull request

For one developer or a small team, epics of about 5–8 tasks, a product not yet live or released in epic-sized steps.

| Step | What happens |
| --- | --- |
| Epic starts (`/build-epic`, or the first `/implement-task` of the epic) | branch `epic/E-xx-<slug>` from current `main`; push it; open a **draft** pull request to `main` titled `E-xx <epic title>` (`gh pr create --draft`, or the user opens it); record `branch:` and `pr:` in `epic.md` |
| Each task | commits on the epic branch (`T-NNN: …`); no task branches. Pushes at each `/build-epic` stop run CI on the draft PR, so integration problems show up per batch of tasks, not at the end |
| Epic reaches `in-uat` | push; mark the PR ready (`gh pr ready`); CI must be green; if `main` moved, merge `main` into the epic branch (not rebase: the branch is shared with the PR) and rerun the tests |
| Review and acceptance, **with preview environments** (one deploy per PR) | `/review-change E-xx` → `/security-review E-xx` against the PR's preview → UAT (`/qa-task E-xx`) on the preview → user merges → staging → production after approval |
| Review and acceptance, **without previews** | `/review-change E-xx` → user merges → staging deploy → `/security-review E-xx` and UAT against **staging** → only then the user approves production. Production approval waits for both |
| After merge | delete the epic branch |

Previews are recommended when the hosting supports them cheaply: review, security testing and UAT then happen before anything reaches `main`.

## Alternative: short task branches into `main` with feature flags

Choose it when at least one holds: the product has users and you want to release small changes often; several people work in parallel; epics grow beyond about two weeks; tasks run in parallel (separate worktrees need separate branches).

- Branch `task/T-NNN-<slug>` from `main`; pull request to `main` after QA `pass`; merge commit.
- Every user-visible change of an unfinished epic sits behind a **feature flag**, off in production. The flag is part of the task's acceptance criteria, tests cover flag on and flag off, and a cleanup task removing the flag is planned in the same epic.
- `/review-change E-xx`, `/security-review E-xx` and UAT run with the flag on in staging; turning the flag on in production is the release, after the user's approval.
- Costs: flag code and tests, two states to test, flag cleanup. Do not choose it just because it is "more trunk-based".

## Fixes

| Kind | Branch from | Into | Deploy |
| --- | --- | --- | --- |
| Bug or small change (`/fix`, `/review-change` and `/security-review` fix tasks of an epic still in review) | the epic branch when the fix belongs to an unmerged epic; otherwise `main` as `fix/T-NNN-<slug>` | the epic branch, or `main` through a pull request | normal pipeline |
| Production incident | the production tag (`vX.Y.Z`), as `hotfix/T-NNN-<slug>` | a pull request to `main` as well (the fix must not get lost); the hotfix path in `pipeline.md` decides whether production is deployed from the hotfix branch or from `main` | hotfix path in `pipeline.md`, still with approval |

## Recording it in `tech-stack.md`

```markdown
## Git workflow

- Variant: epic branch with draft PR | task branches with feature flags
- Main branch: main (protected, PR only, required check ci-ok, no force push)
- Branch names: epic/E-xx-<slug> | task/T-NNN-<slug>; fix/T-NNN-<slug>; hotfix/T-NNN-<slug>
- Merge method: merge commit
- Preview environment per PR: yes (provider) | no → security review and UAT on staging before production approval
- Who merges and approves production: <user>
```
