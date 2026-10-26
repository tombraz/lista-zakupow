---
layer: <name>          # must match the values used in task "layers:" (e.g. db, backend, web, mobile, infra)
status: draft          # draft | approved
approved:
---

# Layer guide: <name>

Read this before touching this layer. Keep it short: facts an agent needs, not a tutorial.

## Purpose

<What this layer is responsible for, in one or two sentences. Which modules from architecture.md live here.>

## Technology

<Language, framework, key libraries, versions. Link to tech-stack.md entries and ADRs.>

## Where the code lives

<Directory layout of this layer. Filled in by the walking-skeleton task with real paths.>

## Commands

| Purpose | Command | Run from |
| --- | --- | --- |
| install | | |
| run locally | | |
| type check / lint | | |
| unit tests (single file) | | |
| all tests of this layer | | |
| build | | |

<Filled in by the walking-skeleton task with commands that actually work.>

## Testing in this layer

- **Default seams:** <e.g. HTTP API for backend, screen for web/mobile>
- **Tools:** <test runner, helpers, containers, emulators>
- **Test data:** <factories, fixtures, how the database is reset>
- **Mocks allowed for:** <external services, clock>

## Security rules

<Rules from the security baseline decisions that apply to this layer, e.g. where authorisation checks live, token storage, headers, input validation. Each rule names the threat IDs it mitigates.>

## Conventions

<Judgement rules specific to this layer that tools cannot check. Each one short and concrete.>

## Pitfalls

<Things that went wrong before and how to avoid them. Grows with QA findings.>

## Skills and references

<Technology skills to use for this layer (e.g. an official framework skill), and external docs.>
