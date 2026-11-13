---
id: T-120
title: "Prośby o reset nie wyczerpują dobowego limitu maili dostawcy"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: in-qa          # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend, db]
requirements: [F-03, N-03]
threats: [TH-10, TH-11, TH-32]
screens: []
related_tasks: [T-053, T-055, T-088]
---

# T-120 Prośby o reset nie wyczerpują dobowego limitu maili dostawcy

## Report

Źródło: przegląd bezpieczeństwa `docs/security/reviews/E-02-2026-11-10-1.md`, znalezisko #3 (medium).

- **Actual:** limit per e-mail (`passwordResetPerEmail`: 3 na 15 min, `packages/shared/src/limits.ts:12-14`) pozwala na ok. 288 maili resetu na dobę na jeden adres. Limit per IP (3/min) go nie zawęża. Darmowy plan Brevo ma 300 maili na dobę (`docs/architecture/deployment.md`). Właściciel listy zna e-maile uczestników (TH-19), więc wystarczą dwa znane adresy, żeby wyczerpać dobowy limit dostawcy. Wtedy nikt nie dostaje maila resetu, a alarmy do właściciela projektu (N-03, `owner-alerts.ts`) nie wychodzą.
- **Expected:** prośby o reset nie zużywają całego dobowego limitu maili; alarmy właściciela mają rezerwę; ofiara nie dostaje setek maili dziennie. Źródło: TH-10 („zalewanie skrzynki”), MC-04, N-03.
- **Steps to reproduce:** przekazane właścicielowi poza repozytorium (repozytorium publiczne); dopisać tu po wydaniu poprawki.
- **Environment:** analiza kodu, `cad0509`; limity Brevo z `deployment.md`.
- **Evidence:** `limits.ts:12-14`, `konta/http/auth-routes.ts:224-238`.

## Acceptance criteria

- [x] AC1: Given dobowe okno per e-mail (10 na 24 h od pierwszej prośby; zatwierdził właściciel 2026-11-13), when przychodzi kolejna prośba dla tego adresu, then odpowiedź jest taka sama jak przy limicie 15-minutowym — 429 `rate_limited` (TH-11: ten sam status i treść dla istniejącego i nieistniejącego konta; decyzja właściciela 2026-11-13), mail nie wychodzi, a w logu `security` jest jedno zdarzenie `rate_limited` z `limit: passwordResetPerEmailDaily`. — verified by: test integracyjny
- [x] AC2: Given wyczerpany globalny dobowy budżet maili resetu (100 na 24 h od pierwszego maila; dwa okna w dobie Brevo + 96 alarmów < 300; zatwierdził właściciel 2026-11-13), when przychodzi prośba, then mail nie wychodzi, odpowiedź się nie zmienia, a właściciel projektu dostaje jeden alarm (tłumiony jak w T-088). — verified by: test integracyjny z adapterem przechwytującym maile
- [x] AC3: Given wyczerpany budżet resetu, when trzeba wysłać alarm N-03, then alarm wychodzi (rezerwa). — verified by: test integracyjny
- [x] AC4: Liczniki nie zapisują nic przed limitem per IP (TH-27) i są sprzątane przez codzienne sprzątanie (T-064). — verified by: test liczby wierszy
- [x] AC5: No regression in: `password-reset*.test.ts`, `cleanup.retention.test.ts`, J-01.

## TDD plan

**Seam:** HTTP API (`fastify.inject`) z bazą Testcontainers i przechwytującym `Mailer`

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `stops sending reset mail to one address after the daily limit, with the same answer` | integracja | Vitest + Testcontainers | AC1 |
| 2 | `stops sending reset mail after the daily budget and alerts the owner once` | integracja | Vitest + Testcontainers | AC2, AC3 |
| 3 | `limits.security.test.ts` › `passwordResetPerIp` / `passwordResetPerEmail` — po limicie IP i 15-minutowym żadna tabela (także `mail_quota`) nie przybiera wierszy (zastępuje planowany osobny test „writes no counter rows…”, QA runda 1 #3) | integracja | Vitest + Testcontainers | AC4 |
| 3a | `limits.security.test.ts` › `passwordResetPerEmailDaily: exceeding the limit repeatedly logs one security event` (żadna tabela nie przybiera wierszy po `atLimit`) | integracja | Vitest + Testcontainers | AC1, AC4 |
| 3b | `cleanup.retention.test.ts` › `deletes daily reset mail counters after their 24 h window`; `cleanup.logs.test.ts` z `mail_quota` | integracja | Vitest + Testcontainers | AC4 |

**Run:** `pnpm vitest run --project api password-reset`

## QA plan

- **Regression:** reset hasła (T-053–T-055, T-088), alarmy N-03, limity per IP i per e-mail.
- **Edge cases:**
  - nieistniejący e-mail liczy się do limitów tak samo jak istniejący;
  - granica doby (strefa Europe/Warsaw jak w sprzątaniu);
  - restart procesu w trakcie doby.
- **Platforms:** API.

## Root cause

T-053 dodał tylko limit 15-minutowy per e-mail (3 / 15 min), bez górnej granicy na dobę ani budżetu łącznego. Analiza limitu Brevo w `deployment.md` liczyła tylko zwykłe resety („kilka miesięcznie”) i alarmy (≤ 96 / dobę), nie nadużycie, więc żaden test nie sprawdzał, ile maili wychodzi w dobie. Testy przypinały wyłącznie okna 15-minutowe i 1-minutowe.

Poprawka: nowa tabela `mail_quota` (okno 24 h od pierwszego maila, licznik jak w `sign_in_failure`). Nie w `rate_limit`, bo Better Auth przy odnowieniu okna kasuje wiersze `rate_limit` starsze niż jego najdłuższe okno (1 h; `better-auth/dist/api/rate-limiter/index.mjs`, `deleteExpiredRows`). Limit per e-mail (`passwordResetPerEmailDaily`, 10) jest sprawdzany na trasie po limicie 15-minutowym, przed `forward()` (429 jak przy limicie 15-minutowym, TH-11). Budżet łączny (`passwordResetMailsDaily`, 100) jest sprawdzany w `sendResetMail` w tle, tylko dla wysyłanych maili, więc odpowiedź się nie zmienia; ponad budżet: log `password_reset_budget_exhausted` i alarm do właściciela (tłumiony per zdarzenie 15 min, T-088). Alarmy nie przechodzą przez budżet (rezerwa, AC3).

Inne wystąpienia: inne maile wychodzą tylko jako alarmy N-03 (już tłumione, T-088). Brak innych tras wysyłających maile.

## Evidence

- Red (przed poprawką), `pnpm vitest run --project api password-reset.daily-limits`:
  - `stops sending reset mail to one address after the daily limit, with the same answer` — `expected [200 ×12] to deeply equal [200 ×10, 429, 429]`.
  - `stops sending reset mail after the daily budget and alerts the owner once` — `expected [] to have a length of 1 but got +0` (brak alarmu po 100 mailach).
- Red dla 3a (spot-check: na trasie wyłączone `mailQuota.take`), `pnpm vitest run --project api limits.security -t passwordResetPerEmailDaily` — `expected { 'public."user"': 1, …(13) } to deeply equal { 'public."user"': 1, …(13) }` (próby ponad limit dobowy dochodzą do Better Auth i dopisują wiersze; mail wychodzi).
- Red dla 3b (spot-check: reguła sprzątania `mail_quota` → `false`): `cleanup.retention` › `deletes daily reset mail counters after their 24 h window` — `expected [ 'open', 'passed' ] to deeply equal [ 'open' ]`; `cleanup.logs` › `logs only table names and row counts` — `expected { session: 1, verification: 1, …(5) } to deeply equal { invitation: 1, …(6) }`.
- Green: oba testy przechodzą; pełny zestaw 159 plików / 1297 testów, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` — bez błędów.
- Decyzje właściciela 2026-11-13: progi 10 / e-mail i 100 łącznie na 24 h; po limicie dobowym per e-mail odpowiedź 429 `rate_limited` (jak limit 15-minutowy).
- Uwaga dla QA: okno dobowe liczone od pierwszej prośby (nie doba kalendarzowa Europe/Warsaw) — jak w pozostałych limitach; budżet 100 jest dobrany tak, by dwa okna w jednej dobie Brevo plus alarmy mieściły się w 300. Licznik w bazie, więc restart procesu go nie zeruje.

## Prevention

Co by zapobiegło: test, który zestawia wszystkie maile z API z dobowym limitem dostawcy. Przyjęte przez właściciela 2026-11-13: `apps/api/test/mail-budget.test.ts` liczy najgorszy przypadek ze stałych (2 okna budżetu × `passwordResetMailsDaily.max` + alarmy `reset_tokens_revoke_failed` co `OWNER_ALERT_WINDOW_SECONDS` + alarmy budżetu) i wymaga ≤ 300 (Brevo). Nowy rodzaj maila albo alarmu dopisuje tam swój najgorszy przypadek.

Liczenie ujawniło lukę w tej poprawce: alarm `password_reset_budget_exhausted` tłumiony tylko co 15 min (T-088) dawał do 96 alarmów na dobę, razem 200 + 96 + 96 = 392 > 300. Poprawka po QA rundzie 2: alarm budżetu wychodzi raz na okno budżetu (pierwsza odmowa, `count === max + 1` z atomowego licznika — `MailQuota.take` zwraca numer maila w oknie). Red: `stops sending reset mail after the daily budget and alerts the owner once` (dopisana prośba 1 h później) — `expected [ { …(3) }, { …(3) } ] to have a length of 1 but got 2`; green: pełny zestaw 160 plików / 1298 testów, lint, typecheck, format, build.

## Incident note

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-11-13)
Verdict: fail

Sprawdzone: `pnpm install --frozen-lockfile`, `pnpm test` dwa razy (1. przebieg: 1 czerwony `routes-nul.test.ts` — zob. #6; 2. przebieg: 159 plików / 1297 testów zielone), `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm quality` — bez błędów. `node scripts/backlog-check.mjs` — **ERROR** (#1).

Kryteria:
- AC1 pass — `password-reset.daily-limits.test.ts` test 1: 10× 200, potem 429 dla istniejącego i nieistniejącego adresu, 10 maili, dwa zdarzenia `rate_limited` z `limit: passwordResetPerEmailDaily` (po jednym na adres); po dobie adres znów dostaje mail.
- AC2 pass — test 2: po 100 mailach kolejne prośby 200, mail nie wychodzi, jeden alarm do właściciela.
- AC3 pass — ten sam test: alarm wychodzi przy wyczerpanym budżecie (alarm idzie przez `ownerAlerts` z pominięciem `MailQuota`).
- AC4 pass — limit per IP to `perIp` (preHandler w pamięci) przed `takeResetLimits`; `limits.security.test.ts` (`passwordResetPerIp`, `passwordResetPerEmail`, `passwordResetPerEmailDaily`) liczy wiersze wszystkich tabel `public`, więc także `mail_quota`; sprzątanie: `cleanup.retention.test.ts` nowy przypadek.
- AC5 pass — `password-reset*.test.ts`, `cleanup.*`, cały zestaw zielony w 2. przebiegu.

Spot-checki (cofnięte, `git status` czysty): `MailQuota.take` → `return true` — oba testy z `password-reset.daily-limits` czerwone; reguła sprzątania `mail_quota` → `false` — `cleanup.retention` (nowy przypadek) i `cleanup.logs` czerwone. Zapis licznika jednym `INSERT … ON CONFLICT … RETURNING` — równoległe prośby nie obejdą limitu; licznik w bazie, więc restart go nie zeruje.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | blocker | CI / dokumentacja | `backlog-check` (krok CI `ci.yml:95`) kończy się błędem: commit T-120 dodał plik testu w warstwie backend, a `docs/architecture/layers/backend.md` ani `db.md` nie mają wiersza T-120 w „## Historia zmian”. | `node scripts/backlog-check.mjs` → `ERROR … commits of T-120 added test apps/api/test/password-reset.daily-limits.test.ts, but … has no row with T-120 under "## Historia zmian"` | Wiersz T-120 w „Historia zmian” `backend.md` (i `db.md`: tabela `mail_quota`, migracja `0009`); `backlog-check` bez ERROR. |
| 2 | major | TDD | Evidence pokazuje czerwień tylko dla testów 1 i 2 planu; brak czerwonego komunikatu dla 3a (`limits.security` › `passwordResetPerEmailDaily`) i 3b (`cleanup.retention`, `cleanup.logs` z `mail_quota`). QA potwierdził spot-checkiem, że 3b gryzie. | sekcja „Evidence” | Czerwony komunikat (albo dowód spot-checku) dla każdego zaplanowanego testu. |
| 3 | minor | Testy | Planowany test 3 `writes no counter rows once the IP limit is exceeded` nie istnieje; AC4 pokrywa ogólny licznik wierszy w `limits.security.test.ts` (scenariusz `passwordResetPerIp`). | `grep -rn "writes no counter rows" apps/` — brak | Dopisać test albo poprawić plan TDD, wskazując istniejący scenariusz. |
| 4 | minor | Dokumentacja | `docs/architecture/deployment.md:22` nadal liczy budżet Brevo jako „kilka miesięcznie + ≤ 96 alarmów”, bez dobowego budżetu 100 maili resetu (dwa okna = 200 + alarmy). | `deployment.md:22` | Wiersz „Mail” z limitami `passwordResetPerEmailDaily` / `passwordResetMailsDaily`. |
| 5 | minor | Dokumentacja | `docs/architecture/threat-model.md:73` (TH-10) wymienia tylko limit per IP i per e-mail, bez limitu dobowego i budżetu łącznego. | `threat-model.md:73` | Mitigacja TH-10 z limitem dobowym i budżetem łącznym (T-120). |
| 6 | note | Testy (istniejące) | `routes-nul.test.ts` › `never logs a raw database exception for NUL input` był raz czerwony w pełnym przebiegu, zielony 3× osobno i w 2. pełnym przebiegu. Wzorzec `/byte sequence\|22021/` może trafić w losowy hex (`requestId` UUID) w logach — test niedeterministyczny, niezwiązany z T-120. | junit 1. przebiegu: `expected '{"level":30,…' not to match /byte sequence\|22021/` | Wzorzec zakotwiczony (np. `"code":"22021"`), osobne zadanie. |
| 7 | note | Bezpieczeństwo | Atakujący z wieloma IP i 10 adresami (10 × 10) wyczerpuje budżet 100 i blokuje resety wszystkim na dobę; właściciel dostaje alarm. Zgodne z decyzją właściciela (alarmy ważniejsze), do odnotowania w TH-10 jako ryzyko szczątkowe. | analiza `index.ts` `sendResetMail` | Ryzyko szczątkowe w `threat-model.md`. |

Do poprawy przed kolejną rundą: #1 (blocker) i #2 (major); #3–#5 przy okazji.

## QA round 2 (2026-11-13)
Verdict: pass

Runda 1 poprawiona tylko w dokumentacji (`38dec0b`); kod `apps/` i `packages/` bez zmian od `cbd9461`. Sprawdzone: `node scripts/backlog-check.mjs` — `OK: no errors` (#1 z rundy 1 zamknięte, wiersze T-120 w „Historia zmian” `backend.md` i `db.md`); `pnpm typecheck`, `pnpm lint`, `pnpm format:check` — bez błędów; `pnpm test` — 158/159 plików, 1296/1297 testów (czerwony tylko `routes-nul.test.ts` › SEC1, zob. #1 niżej; 3× osobno zielony). Testy T-120 (`password-reset.daily-limits`, `limits.security`, `cleanup.*`) zielone.

Kryteria AC1–AC5: pass (jak w rundzie 1; kod bez zmian, testy przeczytane ponownie i zielone w pełnym przebiegu).

Spot-check (cofnięty, `git status` czysty): na trasie `mailQuota.take` → `false` — `limits.security` › `passwordResetPerEmailDaily` czerwony z komunikatem zgodnym z Evidence (#2 z rundy 1 zamknięte). Plan TDD test 3 wskazuje istniejący scenariusz (#3), `deployment.md:22` (#4) i `threat-model.md:73` TH-10 z ryzykiem szczątkowym (#5, #7) poprawione.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | note | Testy (istniejące) | `routes-nul.test.ts` › `never logs a raw database exception for NUL input (SEC1)` znów czerwony w pełnym przebiegu (2. raz w 3 pełnych przebiegach QA), zielony 3× osobno. Wzorzec `/byte sequence\|22021/` (`routes-nul.test.ts:417`) na wszystkich liniach logu trafia w losowe ciągi; niezwiązany z T-120 (plik i logowanie nie zmienione). | pełny `pnpm test` 2026-11-13 | Osobne zadanie: zakotwiczyć wzorzec (np. `"code":"22021"`). |
