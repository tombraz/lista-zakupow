# UAT E-02 Konto i zarządzanie udostępnianiem (web)

Przygotował: QA (po T-069), 2026-11-03. Wykonuje: właściciel. Miejsce: staging `https://lista-staging.fly.dev` (workflow bez środowisk podglądowych — `docs/architecture/tech-stack.md`, „Git workflow”). Kolejność przed UAT: `/review-change E-02` (ostatni przegląd `docs/reviews/E-02-2026-11-09-1.md`, runda 4, ma `Verdict: fail` — po zamknięciu jego zadań naprawczych potrzebna nowa runda z `pass`; stan na 2026-11-09), `/security-review E-02` (brak przeglądu w `docs/security/reviews/`), potem `/qa-task E-02`.

## Przed UAT (warunki z tego epiku)

- [ ] PR #13 zmergowany do `main` (2026-11-03T09:34Z), `deploy.yml` z commitu merge `5de6893` zielony (`image`, `staging`, `zap` — run 41612128862, próba 2). Stan na 2026-11-03: spełnione.
- [ ] Sekrety staging `BREVO_API_KEY`, `MAIL_FROM`, `ALERT_EMAIL` wdrożone (`fly secrets list -a lista-staging`). Stan na 2026-11-03: spełnione.
- [ ] CI na `main` dla `5de6893` czerwone przez znany flake `57P01` (wszystkie 1160 testów zielone) — T-052 (todo). Zdecyduj, czy akceptujesz to przy UAT.

## Kroki

Przygotuj dwa konta testowe z prawdziwymi skrzynkami (A — właściciel listy, B — uczestnik), komputer z przeglądarką i telefon. Najlepiej, by jedno konto miało skrzynkę spoza Gmaila (Onet, WP, Outlook) — ten dostawca nie był testowany.

1. [ ] **Reset hasła — mail.** Wyloguj się, na `/reset-hasla` poproś o reset dla A. Oczekiwane: komunikat SC-03; mail „Reset hasła — Wspólna lista zakupów” w ciągu minuty (zanotuj: odbiorcza czy spam, nadawca `…brevosend.com`), polskie znaki w temacie i treści poprawne, link `https://lista-staging.fly.dev/reset-hasla?token=…` klikalny także w podglądzie na telefonie.
2. [ ] **Reset hasła — nowe hasło.** Z linku ustaw nowe hasło (co najmniej 8 znaków). Oczekiwane: logujesz się nowym hasłem; stare hasło nie działa.
3. [ ] **Link jednorazowy i wygasający.** Otwórz ten sam link ponownie. Oczekiwane: „Ten link wygasł albo został już użyty.”. Poproś o dwa linki po kolei, użyj nowszego, otwórz starszy — też nie działa. (Wygaśnięcia po 1 h nie musisz czekać — pokrywają je testy; opcjonalnie otwórz link po godzinie.)
4. [ ] **Ten sam komunikat i limit.** Poproś o reset dla e-maila bez konta — ten sam komunikat, mail nie przychodzi. Poproś o reset dla A czwarty raz w ciągu 15 min — „Zbyt wiele próśb o reset…”, mail nie przychodzi.
5. [ ] **Reset kończy inne sesje.** Zaloguj A na telefonie z otwartą listą, na komputerze zresetuj hasło A. Oczekiwane: telefon przestaje dostawać zmiany i przy następnej akcji wraca do logowania.
6. [ ] **Uczestnicy (SC-07).** A udostępnia listę B (link zaproszenia). Na SC-07 obaj widzą imiona i „Na liście (N z 20)”; A widzi e-mail B, B nie widzi e-maili innych.
7. [ ] **Usunięcie uczestnika natychmiast (MC-03).** B ma otwartą listę; A usuwa B na SC-07. Oczekiwane: B natychmiast traci dostęp, nie może niczego zmienić i wraca na SC-05 z komunikatem; pozycje dodane przez B zostają z jego imieniem.
8. [ ] **Opuszczenie listy.** Zaproś B ponownie; B wybiera „Opuść listę”. Oczekiwane: lista znika z SC-05 B; A nie ma przycisku opuszczenia własnej listy.
9. [ ] **Zmiana imienia (SC-09).** B zmienia imię. Oczekiwane: nowe imię u A przy pozycjach i na SC-07 w ≤ 5 s; puste lub dłuższe niż 30 znaków — czytelny błąd.
10. [ ] **Usunięcie konta (F-04).** B (uczestnik listy A, z dodaną pozycją) usuwa konto po potwierdzeniu. Oczekiwane: B wypisany z listy, pozycja z podpisem „usunięty użytkownik”; logowanie na konto B nie działa; otwarta sesja B na drugim urządzeniu przestaje działać.
11. [ ] **Brak połączenia.** Na telefonie z otwartą listą włącz tryb samolotowy. Oczekiwane: pasek „Brak połączenia. Zmiany nie są zapisywane.”, zapisy nieaktywne. W tym czasie A zmienia listę; po wyłączeniu trybu pasek znika, lista pokazuje zmiany A.
12. [ ] **Regresja E-01.** Logowanie, tworzenie listy, zaproszenie, zmiany na żywo (≤ 5 s) działają jak w UAT E-01.

## Znane ograniczenia

- Wysyłka Brevo sprawdzona tylko w Gmailu (odbiorcza); inni dostawcy nieprzetestowani, ryzyko spamu (`deployment.md`, „Ryzyka”). Brevo przepisuje nadawcę na `<login>@<id>.brevosend.com`.
- Przegląd kodu E-02 runda 1 (2026-11-02) `fail`: zadania naprawcze T-070–T-072, T-074 i T-076–T-082 `done` (PR #14 zmergowany 2026-11-04), tak samo poprawki z gałęzi epiku T-083, T-085–T-087 i T-089; T-084 nadal `todo`.
- Przegląd kodu E-02 runda 2 (2026-11-04, `docs/reviews/E-02-2026-11-04-1.md`) `fail`; zadania naprawcze w `docs/backlog/fixes/` (PR #15): T-094 (SC-06: akcje uczestnika, blocker P1), T-095 (kontrakt błędów), T-096 (Copy SC-03/SC-09), T-097 (fokus SC-07), T-098 (log błędów w tle), T-099 (`backlog-check`) `done`, tak samo propozycje prewencji z tej rundy T-100 (test zgodności tekstów z Copy), T-101 (eslint `log.error` tylko w `logging`) i T-102 (`backlog-check`, małe litery). Z wcześniej otwartych: T-090–T-093 `todo` (T-092 rozszerzone na testy `apps/web`). Stan na 2026-11-06.
- Przegląd kodu E-02 runda 3 (2026-11-06, `docs/reviews/E-02-2026-11-06-1.md`) `fail`; zadania naprawcze na gałęzi epiku: T-103 (teksty okna „Opuść listę” w Copy) i T-104 („Usuń listę” nieaktywne bez połączenia) `done`; T-105 (jedna tabela błędów, `listId`, `backend.md`, ten stan UAT) i T-106 (teksty komponentów w rejestrze Copy, z QA T-103) `done`; z QA T-106: T-107 (atrybuty JSX w teście Copy) i T-108 (wiersz `legal` SC-01) `done`. P5 rozstrzygnięte poprawką BRD F-03 (wersja 1.4), P7 — T-052, T-066–T-068 odpięte od epiku (`epic.md`). Stan na 2026-11-09.
- Przegląd kodu E-02 runda 4 (2026-11-09, `docs/reviews/E-02-2026-11-09-1.md`) `fail`; zadania naprawcze na gałęzi epiku: T-109 (teksty modułów wspólnych tylko w `<nazwa>Messages.ts`) `done`; T-110 (odhaczone AC i statusy tego UAT pilnowane przez `backlog-check`) `done`; T-111 (wiersze Copy bez kodu web) `done`; T-112 (`MenuAction.writes` wymagane) `done`; T-113 (dopisek Copy „pokazuje SC-xx” sprawdzany, z QA T-111) `done`. Stan na 2026-11-10.
- Poprawki z UAT E-01 nadal otwarte, poza zakresem epiku: T-052 (flake `57P01` w CI), T-066 (pusty `h1` SC-06), T-067 („Wszystko kupione” na pustej liście SC-05), T-068 (alert CodeQL w teście); T-047 zablokowane.
- Staging usypia po kilku minutach bez ruchu; pierwsze żądanie trwa kilka sekund.
- Poza zakresem: aplikacja mobilna (E-04), produkcja (E-03).

## Wynik

<Uzupełnia `/qa-task E-02` po potwierdzeniu przez właściciela.>
