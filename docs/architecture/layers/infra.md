---
layer: infra
status: approved          # draft | approved
approved: 2026-10-26
---

# Przewodnik warstwy: infra

## Cel

Lokalne środowisko (Docker Compose), CI (GitHub Actions), wdrożenie, sekrety, kopie zapasowe i monitoring. Decyzje: `../deployment.md` (hosting, środowiska, sekrety) i `../pipeline.md` (etapy, joby, wycofanie).

## Technologia

Docker Compose (PostgreSQL + Mailpit), GitHub Actions (repo publiczne, ADR 0007), pnpm. Hosting (ADR 0006):

| Komponent | Dostawca | Staging | Produkcja |
| --- | --- | --- | --- |
| API + web (jeden origin) | Fly.io `fra`, obraz `ghcr.io/tombraz/lista-zakupow:<sha>` | `lista-staging.fly.dev` (auto-stop) | `lista-prod.fly.dev` (1 maszyna, bez auto-stop) |
| Baza | Neon Frankfurt | projekt `lista-staging` (Free) | projekt `lista-prod` (Launch, przywracanie 7 dni) |
| Mail | Brevo, zweryfikowany adres nadawcy (bez własnej domeny) | osobny klucz | osobny klucz |
| Monitoring | UptimeRobot (mail) | — | `lista-prod.fly.dev/health` |
| Mobile | EAS Free, APK internal distribution (Android); iOS tylko build symulatora (ADR 0008) | profil `staging` | profil `production` |

## Gdzie jest kod

Istnieje (T-001): `docker-compose.yml` (PostgreSQL 17.11 na `localhost:5442`, Mailpit v1.32.0 `localhost:1025` / `8025`), `.env.example`, `.nvmrc` oraz `engines` / `packageManager` w `package.json` (Node 24, pnpm 12.11.2), `pnpm-workspace.yaml` (`allowBuilds` tylko dla esbuild), `.gitattributes` (LF), konfiguracje sprawdzeń w korzeniu: `eslint.config.js`, `.prettierrc.json`, `.jscpd.json`, `.dependency-cruiser.cjs`, `vitest.config.ts`.

Istnieje (T-002): `.github/workflows/ci.yml` (joby per warstwa przez `dorny/paths-filter`, zbiorczy `ci-ok`), `.github/workflows/security.yml` (CodeQL, check `codeql`), `.github/actions/setup/` (pnpm, Node z `.nvmrc`, `pnpm install` z cache), `.github/dependabot.yml`, `SECURITY.md`, `scripts/protect-main.sh` (ustawienia repo, uruchamia właściciel) z testem `scripts/test/protect-main.test.sh`. Tag obrazu Postgresa ma jedno źródło: `docker-compose.yml` (czytają go `apps/api/test/database-constants.ts`, E2E i job `migrations` w CI).

Istnieje (T-003): joby `mobile`, `mobile-android` (emulator z KVM, Maestro przypięty wersją i SHA-256) i `mobile-ios` (`macos-latest`) w `.github/workflows/ci.yml`; skrypty `scripts/android-emulator.sh`, `scripts/mobile-e2e.sh`, `scripts/ios-simulator-build.sh` z testem `scripts/test/mobile.test.sh` (oczekiwane wyjścia `--dry-run` w `scripts/test/*.dry-run.txt`).

Istnieje (T-010): `Dockerfile` i `.dockerignore` (obraz `ghcr.io/tombraz/lista-zakupow:<sha>`: API z `apps/api/dist/server.js` i migracjami `apps/api/dist/db/migrate.js`, web z `apps/web/dist`, użytkownik `node`, port 8080), `apps/api/fly.staging.toml`, `.github/workflows/deploy.yml` (joby `image` → `staging` → `zap`), job `image` w `ci.yml` (build, uruchomienie i Trivy na PR), skrypty `scripts/image.sh` (build / scan / push), `scripts/deploy.sh`, `scripts/smoke.sh`, `scripts/zap.sh` z `scripts/zap-high-alerts.mjs` i progami `.zap/rules.tsv`, `scripts/staging-setup.sh` (jednorazowo, właściciel) oraz testy `scripts/test/{deploy,deploy-workflow,image,image-run,smoke,zap,staging-setup}.test.sh` (oczekiwane wyjścia `--dry-run` w `scripts/test/*.dry-run.txt`, atrapy w `scripts/test/fixtures/`).

Istnieje (T-013): `scripts/workflow-check.mjs` (znacznik `TYMCZASOWE` w `.github/workflows/` zatrzymuje `pnpm check` i job `always` w CI) z testem `scripts/test/workflow-check.test.sh`; `deploy.yml` wdraża staging tylko z `main` i przez `workflow_dispatch`.

Planowane (kolejne taski infra): `mobile.yml`, `apps/api/fly.production.toml`, `apps/mobile/eas.json`.

## Komendy

| Cel | Komenda | Skąd |
| --- | --- | --- |
| start usług lokalnych | `pnpm services:up` (`docker compose up -d --wait`) | korzeń repo |
| stop i czyszczenie | `pnpm services:down` (stop); `pnpm services:reset` (usuwa też wolumen bazy) | korzeń repo |
| lokalny przebieg CI | `pnpm check` (format, lint, typy, jscpd, dependency-cruiser, design-check, backlog-check, testy), potem `pnpm test:e2e` | korzeń repo |
| raport pokrycia | `pnpm test:coverage` (wynik w `coverage/`) | korzeń repo |
| actionlint (rung 1) | `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12` (Git Bash na Windows: poprzedź `MSYS_NO_PATHCONV=1`) | korzeń repo |
| testy skryptów (rung 2) | `bash scripts/test/protect-main.test.sh`; `bash scripts/test/mobile.test.sh` | korzeń repo |
| skan zależności | `pnpm audit --audit-level high` | korzeń repo |
| testy skryptów wdrożenia (rung 2) | `bash scripts/test/deploy.test.sh`; `deploy-workflow`, `workflow-check`, `image`, `smoke`, `zap`, `staging-setup` analogicznie | korzeń repo |
| test przebiegu komentarzy z `pnpm lint` (obejścia padają; job `static`, bo potrzebuje zależności) | `bash scripts/test/lint-directives.test.sh` | korzeń repo |
| obraz lokalnie (build, migracje, smoke) | `bash scripts/test/image-run.test.sh` (Docker; baza z `pnpm services:up`) | korzeń repo |
| skan obrazu (Trivy) | `bash scripts/image.sh scan <sha>` (po `bash scripts/image.sh build <sha>`) | korzeń repo |
| smoke test / ZAP | `bash scripts/smoke.sh staging` lub `bash scripts/smoke.sh http://localhost:<port>`; `bash scripts/zap.sh staging` (raport w `zap-report/`) | korzeń repo |
| przygotowanie staging (właściciel) | `STAGING_DATABASE_URL='…?sslmode=require' bash scripts/staging-setup.sh --dry-run`, potem bez `--dry-run` | korzeń repo |
| ochrona `main` i ustawienia bezpieczeństwa (właściciel) | `bash scripts/protect-main.sh --dry-run`, potem bez `--dry-run` (kroki w `SECURITY.md`) | korzeń repo |

## Testy w tej warstwie

- **Seam:** przebieg pipeline'u (job `ci-ok`), skrypty `scripts/*.sh` i healthcheck wdrożonego środowiska.
- **Drabina weryfikacji** (`.claude/skills/ci-cd/references/github-actions.md`, „Validation”): 1) `actionlint` (obraz `rhysd/actionlint` z przypiętą wersją) na wszystkich workflow; 2) skrypty z trybem `--dry-run`, uruchamiane lokalnie; 3) prawdziwy przebieg na PR, a dla bramek dowód porażki (celowo zepsuty test daje czerwony `ci-ok`); 4) wdrożenie staging, smoke test i celowo nieudany smoke test uruchamiający wycofanie. Dowody QA: linki do przebiegów workflow.
- **Narzędzia:** GitHub Actions, actionlint; `/health/ready` w smoke teście; test odtworzenia kopii Neon raz przed pilotażem.
- **Mocki:** brak.

## Zasady bezpieczeństwa

- Sekrety tylko w sekretach GitHub i platformy hostingowej; `.env` w `.gitignore`, `.env.example` bez wartości (TH-22).
- Skan zależności (blokuje high/critical) i sekretów w każdym PR (TH-22, TH-23).
- HTTPS i WSS wszędzie, HSTS; połączenie API–baza szyfrowane (TH-24).
- Nagłówki bezpieczeństwa web (CSP, `Referrer-Policy: no-referrer`, `frame-ancestors 'none'`) w konfiguracji hostingu, sprawdzane w CI (TH-08, TH-15).
- Baza i kopie dostępne tylko dla API i właściciela projektu; kopie szyfrowane (TH-07).
- Uprawnienia workflow GitHub Actions minimalne (`permissions:` per job).

## Konwencje

- Każdy workflow stosuje `.claude/skills/ci-cd/references/github-actions.md` (minimalne `permissions`, akcje przypięte do SHA, sekrety tylko ze środowisk, `concurrency`, `timeout-minutes`).
- Logika dostawców w `scripts/` (uruchamialna lokalnie), YAML tylko je wywołuje.
- Jeden build na commit `main` (obraz `:<sha>` z API i web), promowany na staging i produkcję; web używa względnych adresów API (ten sam origin).
- Produkcja tylko przez `deploy.yml` z akceptacją środowiska `production`; komendy produkcyjne lokalnie blokuje reguła ask w `.claude/settings.json` (`../pipeline.md`).
- Ustawienia repozytorium (ochrona `main`, środowiska, sekrety) zmienia właściciel: task przygotowuje skrypt `gh` lub listę kroków.
- Migracje bazy jako krok wdrożenia przed startem nowej wersji API.
- Wersje narzędzi przypięte (Node, pnpm, obrazy Docker z tagiem wersji).

## Pułapki

- Testcontainers na Windows wymaga działającego Docker Desktop; w CI runner `ubuntu-latest` ma Dockera.
- Neon usypia po 5 min bez połączeń: healthchecki zewnętrzne tylko na `/health` (bez bazy), pula połączeń zamyka bezczynne — inaczej rośnie rachunek (`../deployment.md`, ryzyka).
- E2E web na Windows biegnie na 1 workerze: zamknięcie gniazda przez API blokowało jego pętlę zdarzeń ~10 s, gdy równolegle kończył pracę inny proces przeglądarki (T-001). Na Linuksie (CI) workery równoległe.
- Porty hosta w Compose są stałe (5442, 1025, 8025): drugi klon repo na tej samej maszynie nie wystartuje `pnpm services:up`, dopóki działa pierwszy (`pnpm services:down` w pierwszym).
- Przerwane przebiegi testów mogą zostawić kontenery Testcontainers. Sprząta je Ryuk (zostaw go włączonego, także w CI: nie ustawiaj `TESTCONTAINERS_RYUK_DISABLED`); ręcznie: `docker ps --filter label=org.testcontainers=true`, potem `docker rm -f <id>`.
- Wymagane checki `ci-ok` i `codeql` muszą raportować na każdym PR: `security.yml` i job `ci-ok` nie mają filtra ścieżek (pominięty wymagany workflow blokowałby merge).
- Emulator Androida w CI wymaga KVM na runnerze Linux; build Gradle lokalnie w jobie, nie przez EAS (limit 15 buildów).

## Skille i źródła

- `/ci-cd` — research hostingu i projekt pipeline'u.

## Historia zmian

| Data | Zmiana |
| --- | --- |
| 2026-10-26 | `/ci-cd`: hosting, środowiska, weryfikacja tasków infra, konwencje workflow. Bez własnej domeny: web serwowany przez API na Fly (ADR 0006). |
| 2026-10-27 | T-002: CI i bezpieczeństwo — „Gdzie jest kod”, „Komendy”, „Pułapki” (uwagi z QA T-001). |
| 2026-10-27 | T-001 (QA round 1): sekcja „Komendy” uzupełniona (wiersze trafiły wcześniej przed frontmatter). |
| 2026-10-29 | T-013: staging tylko z `main`; `workflow-check` odrzuca `TYMCZASOWE` w workflow. |
| 2026-10-30 | T-046: `scripts/test/lint-directives.test.sh` w jobie `static` sprawdza, że przebieg komentarzy z `pnpm lint` odrzuca znane obejścia. |
