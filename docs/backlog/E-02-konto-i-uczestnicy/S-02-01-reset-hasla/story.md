---
id: S-02-01
epic: E-02
title: Reset hasła mailem (web)
status: in-progress    # todo | in-progress | done
requirements: [F-03]
screens: [SC-03, SC-01, SC-02]
---

# S-02-01 Reset hasła mailem (web)

**As** domownik, który zapomniał hasła, **I want** dostać na e-mail link do ustawienia nowego hasła, **so that** odzyskuję dostęp do swoich list bez zakładania nowego konta.

## Acceptance criteria (business)

- [ ] Given istniejące konto, when domownik poprosi o reset dla swojego e-maila, then dostaje mail z linkiem do ustawienia nowego hasła (lokalnie w Mailpit, na staging w prawdziwej skrzynce).
- [ ] Given dowolny e-mail, when ktoś poprosi o reset, then komunikat w aplikacji jest taki sam niezależnie od tego, czy konto istnieje.
- [ ] Given link resetu, when domownik ustawi nowe hasło (co najmniej 8 znaków), then loguje się nowym hasłem, a stare przestaje działać.
- [ ] Given link resetu użyty albo starszy niż 1 godzina, when ktoś go otworzy, then nie może ustawić hasła i widzi „Ten link wygasł albo został już użyty.”.
- [ ] Given zbyt wiele próśb o reset, when ktoś prosi dalej, then dostaje „Zbyt wiele próśb o reset…” i mail nie wychodzi (MC-04).
- [ ] Given domownik zalogowany na innym urządzeniu, when zresetuje hasło, then tamte sesje i ich połączenia na żywo przestają działać.

## Tasks

- T-053 Prośba o link resetu: mail z linkiem (lokalnie, Mailpit)
- T-054 Nowe hasło z linku; reset kończy wszystkie sesje
- T-055 Mail resetu przez Brevo na staging
- T-069 Weryfikacja maila resetu przez Brevo na staging (po merge epiku na `main`)
- T-088 Alert mailem do właściciela, gdy reset nie unieważni pozostałych linków (change request 2026-11-02, z T-087)

## Notes

- SC-03 pod trasą `/reset-hasla` (linkują tam już SC-01 i komunikat o zajętym e-mailu na SC-02). Każdy link do SC-03 przenosi wpisany e-mail i kontekst zaproszenia jak `EntryLink` (WCAG 3.3.7; T-028).
- To jedyny mail wysyłany przez aplikację (F-03). Nadawca na staging bez własnej domeny: ryzyko spamu i odmowy Brevo (`deployment.md`, „Ryzyka”).
- TH-28 (przegląd bezpieczeństwa E-01, #6 rundy 1): reset unieważnia sesje i zamyka ich połączenia na żywo.

## Story acceptance (QA, 2026-11-01)

Wszystkie taski `done`. Kryteria 2–6 i część 1 (mail w Mailpit lokalnie) potwierdzone zielonymi testami T-053/T-054/T-055 (`pnpm check`, 589/589). **Luka:** kryterium 1 „na staging w prawdziwej skrzynce” nie jest jeszcze zweryfikowane — wg decyzji właściciela w T-055 wysyłka przez Brevo na staging jest możliwa dopiero po wdrożeniu gałęzi epiku z `main`. Story zostaje `in-progress`.

**Proponowany task:** „Weryfikacja maila resetu przez Brevo na staging” (`depends_on: [T-055]`, `layers: [infra]`): po wdrożeniu — sekrety `BREVO_API_KEY`, `MAIL_FROM` (`fly secrets list` bez wartości), reset dla konta testowego, mail w skrzynce / spamie, czas dostarczenia, czy Brevo przyjmuje nadawcę z darmowej poczty; zielony skan sekretów w CI; wpis w `deployment.md` (zmienne `MAILER`, `MAIL_FROM`; zamknięcie „Wysyłka Brevo bez własnej domeny”). Zamyka AC4 i SEC2 z T-055.

**Zaplanowano (2026-11-01, `/plan-backlog`):** T-069 — weryfikacja po merge E-02 na `main` (decyzja właściciela: bez ręcznego wdrażania gałęzi epiku, zasada z T-013 bez zmian).
