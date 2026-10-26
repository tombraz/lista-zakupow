---
status: draft          # draft | approved
approved:
---

# Architecture

## Context

```mermaid
flowchart LR
  user[Persona] --> app[Product]
  app --> ext[External system]
```

<One sentence per external system: what it does for us and what happens when it is down.>

## Containers

```mermaid
flowchart LR
  web[Web app] --> api[Backend API]
  mobile[Mobile app] --> api
  api --> db[(Database)]
```

| Container | Technology | Responsibility | Requirements |
| --- | --- | --- | --- |

## Modules (domain boundaries)

| Module | Owns (glossary terms) | Exposes | Depends on |
| --- | --- | --- | --- |

## Authentication and authorisation

<How users sign in on each platform; roles and permissions mapped to BRD business rules.>

## API and error conventions

<Resource naming, versioning, pagination, error format, validation, idempotency where needed.>

## Core journeys

### J-01 <name>

```mermaid
sequenceDiagram
  actor U as User
  U->>Web: action
  Web->>API: request
  API->>DB: query
```

## Quality attributes

| N-xx | Requirement | How it is met | How it is verified |
| --- | --- | --- | --- |

## Observability

<Logging rules (no personal data), error tracking, health checks, product analytics events for BRD success metrics.>

## Open questions

- [ ] <question>
