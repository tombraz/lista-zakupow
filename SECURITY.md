# Bezpieczeństwo

## Zgłaszanie podatności

Podatności zgłaszaj prywatnie: zakładka **Security → Report a vulnerability** w tym repozytorium (GitHub private vulnerability reporting). Nie zakładaj publicznego issue ani PR z opisem podatności.

Podaj: czego dotyczy (web, API, aplikacja mobilna), kroki do odtworzenia i możliwy skutek. Odpowiedź w ciągu 7 dni; poprawka trafia na produkcję zwykłym pipeline'em (`docs/architecture/pipeline.md`).

Zakres: kod w tym repozytorium oraz środowiska `lista-staging.fly.dev` i `lista-prod.fly.dev`. Nie testuj aktywnie produkcji (skanery, obciążenie) i nie korzystaj z cudzych kont ani danych.

## Kontrole w repozytorium

| Kontrola                                                                                   | Gdzie                            | Zagrożenie          |
| ------------------------------------------------------------------------------------------ | -------------------------------- | ------------------- |
| `pnpm audit --audit-level high` blokuje `ci-ok`                                            | `.github/workflows/ci.yml`       | TH-22               |
| CodeQL (JavaScript/TypeScript) na PR, push do `main` i co tydzień, wymagany check `codeql` | `.github/workflows/security.yml` | TH-15, TH-20        |
| ESLint: zakaz `dangerouslySetInnerHTML`, `sql.raw`, `eval`, `localStorage`                 | `eslint.config.js`               | TH-15, TH-16, TH-20 |
| Dependabot (npm, GitHub Actions; co tydzień, grupowane)                                    | `.github/dependabot.yml`         | TH-22               |
| Akcje przypięte do SHA, `permissions: contents: read` domyślnie                            | `.github/workflows/`             | TH-22               |
| Secret scanning z push protection                                                          | ustawienia repozytorium          | TH-22, TH-23        |

## Konfiguracja repozytorium (właściciel)

Ustawienia repozytorium zmienia tylko właściciel. Wymagany `gh` zalogowany na koncie z uprawnieniem admin.

1. Podejrzyj komendy: `bash scripts/protect-main.sh --dry-run`.
2. Uruchom je: `bash scripts/protect-main.sh`. Skrypt:
   - chroni `main`: tylko przez PR, wymagane checki `ci-ok` i `codeql`, bez force push i usuwania gałęzi, także dla administratorów;
   - włącza secret scanning z push protection;
   - włącza private vulnerability reporting i alerty Dependabot;
   - wyłącza CodeQL „Default setup” (analizę robi workflow `security.yml`; oba naraz kolidują).
3. Sprawdź w **Settings → Branches** (reguła dla `main`) i **Settings → Code security**, że ustawienia są włączone; zrób zrzut ekranu do dowodów taska T-002.
4. Sprawdź push protection: utwórz token GitHub (fine-grained, bez uprawnień, ważny 1 dzień), dopisz go do pliku na gałęzi `ci-test/T-002-secret`, zrób commit i `git push`. Plik musi być w UTF-8: Windows PowerShell 5.1 zapisuje `echo … > plik` w UTF-16, którego GitHub nie skanuje (push przejdzie mimo włączonej ochrony) — użyj `Set-Content -Encoding ascii` albo Git Bash. Push musi zostać odrzucony z komunikatem o wykrytym sekrecie. Potem usuń commit (`git reset --hard HEAD~1`), gałąź i unieważnij token.
5. Sprawdź blokadę merge: draft PR do `main` z gałęzi z celowo zepsutym testem pokazuje czerwony `ci-ok` i zablokowany przycisk merge; zamknij PR bez merge'a i usuń gałąź.
