# Code quality: principles in checkable form

Used by `/tech-architecture` (Step 6b, `CODING_STANDARDS.md`), `/implement-task` (refactor step), `/qa-task` and `/review-change` (review). Principles are only useful when they turn into a tool check or a concrete review question. A finding always names the principle and the location: "SRP: `ListService` changes for sharing rules and for e-mail formatting (`list-service.ts:40–120`)", never "code could be cleaner".

## Enforced by tools (CI fails)

Choose per stack with the user; configure them in the walking-skeleton task; thresholds go into `CODING_STANDARDS.md`.

| Check | What it enforces | Examples (pick what fits the stack) |
| --- | --- | --- |
| Duplicate code with a threshold | DRY for copy-pasted blocks | jscpd (many languages), PMD CPD (Java, Kotlin), Sonar duplication gate |
| Complexity and size limits | small units, one job each (SRP at function level) | ESLint `complexity`, `max-lines-per-function`, `max-params`, `max-depth`; detekt (Kotlin); SwiftLint `cyclomatic_complexity`, `function_body_length`; Ruff/Pylint (Python) |
| Dependency direction between modules | architecture boundaries, dependency inversion: the domain does not import the database, the framework or the UI | dependency-cruiser or eslint-plugin-boundaries (JS/TS), ArchUnit or Konsist (JVM/Kotlin), import-linter (Python) |
| Type check in strict mode, no unused code | dead code, unclear contracts | TypeScript `strict`, `noUnusedLocals`; compiler warnings as errors |

Start with thresholds the walking skeleton passes comfortably, then tighten; in brownfield projects, set them to the baseline numbers so they cannot get worse (`baseline.md`, "Static checks").

## Principles in practical form (review questions)

**Single responsibility (S).** Each module, class, component or hook has one reason to change. Question: "Which two kinds of requirement change would both force an edit here?" If there are two, split. UI: a component renders; data fetching and business rules live in hooks or modules.

**Open/closed (O).** Adding a new variant (a payment method, a notification channel) should mean adding code, not editing a growing `switch` in five places. Apply when a second variant actually exists, not in advance.

**Liskov substitution (L).** An implementation of an interface keeps its promises: no "not supported" exceptions, no stricter inputs, no weaker outputs. Question: "Would a test written against the interface pass for every implementation?"

**Interface segregation (I).** Callers depend only on what they use: small interfaces, components with focused props, no "god" service passed everywhere.

**Dependency inversion (D).** Business logic depends on abstractions it owns; adapters for databases, external APIs, time and randomness implement them at the edge. This is the same boundary at which tests may mock (testing strategy: mock only at system boundaries). Enforced by the dependency rules above.

**DRY: one place for each piece of knowledge.** A business rule, a validation, a constant, a mapping exists once. Two pieces of code that look alike but change for different reasons are **not** duplication; merging them couples unrelated things. Rule of three: extract on the third real repetition of the same knowledge, not on the second look-alike.

## Against over-engineering (also findings)

- **YAGNI:** no interface with one implementation and no second planned, no factory for one product, no configuration for values nobody changes, no layer "for later". These are findings just like duplication.
- **The wrong abstraction is worse than duplication.** A shared function with flags for each caller (`format(x, isAdmin, legacy, compact)`) is a finding; inline it back and duplicate until the real pattern is clear.
- **KISS:** prefer the plain solution the next reader understands without the history.
- Patterns are named only when they are used; a pattern is never a goal of a task.

## The refactor step (TDD)

After each green test: with all tests green, improve the code just written and the code it touches. Remove duplication of knowledge, clarify names (BRD glossary), extract functions or modules, simplify conditionals, move logic to where its responsibility lies. Rules:

1. No behaviour change: no new feature, no test edits (a test changes only if its seam moves, and then only its setup, never its assertions).
2. Run the tests after each refactoring; they stay green.
3. Stop when the code is clear for this task; do not refactor code the task does not touch (that is a separate task or a note).
4. Before handover, one pass over the task's whole diff against these review questions and `CODING_STANDARDS.md`.
