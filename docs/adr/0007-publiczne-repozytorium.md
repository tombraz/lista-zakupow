# 0007. Publiczne repozytorium na GitHub

- Status: przyjęty
- Data: 2026-10-26
- Decyduje: Tomasz Brążkiewicz

## Kontekst

Pipeline wymaga ochrony gałęzi `main` (wymagany check `ci-ok`, bez force push), środowiska `production` z wymaganym akceptującym, skanu sekretów z push protection i analizy statycznej. Na planie GitHub Free prywatne repozytorium nie ma żadnej z tych funkcji (docs.github.com, „GitHub's plans”, „Managing environments for deployment”, „About GitHub Advanced Security”, sprawdzone 2026-10-26).

## Decyzja

Repozytorium `tombraz/lista-zakupow` staje się publiczne. Zmianę widoczności wykonuje właściciel (ustawienie repozytorium) przed pierwszym taskiem CI.

## Rozważane alternatywy

- **Prywatne + GitHub Pro:** ochrona gałęzi i środowiska, ale bez secret scanning i CodeQL (Secret Protection i Code Security tylko dla Team / Enterprise); skany zastąpione gitleaks, Semgrep CE i OSV-Scanner. Koszt miesięczny.
- **Prywatne na Free:** bez ochrony `main` i akceptacji; produkcja przez ręcznie uruchamiany `workflow_dispatch`; reguły pilnowane dyscypliną.

## Konsekwencje

- Kod, dokumentacja (BRD, model zagrożeń) i historia commitów są publiczne. Przed zmianą widoczności sprawdzić historię gitleaks'em; sekrety i dane osobowe nigdy nie trafiają do repo (`.env` w `.gitignore`).
- Model zagrożeń opisuje mitygacje, nie luki bez poprawki; nowe znalezione podatności zgłaszane prywatnie przez `SECURITY.md` (private vulnerability reporting).
- Obraz API w GHCR może być publiczny (nie zawiera sekretów) — Fly pobiera go bez poświadczeń.
- Workflow nie używa `pull_request_target`; PR z forków nie dostają sekretów.
