# UAT E-02 Konto i zarządzanie udostępnianiem (web)

Przygotował: QA (po T-069), 2026-11-03. Wykonuje: właściciel. Miejsce: staging `https://lista-staging.fly.dev` (workflow bez środowisk podglądowych — `docs/architecture/tech-stack.md`, „Git workflow”). Kolejność przed UAT: `/review-change E-02` (ostatni przegląd `docs/reviews/E-02-2026-11-02-1.md` ma `Verdict: fail` — potrzebna nowa runda z `pass`), `/security-review E-02` (brak przeglądu w `docs/security/reviews/`), potem `/qa-task E-02`.

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
- Przegląd kodu E-02 runda 1 (2026-11-02) `fail`; otwarte zadania naprawcze w `docs/backlog/fixes/`: T-070 (NUL w parametrach tras), T-071 (ogłaszanie komunikatów sukcesu), T-072, T-074, T-076–T-082, T-084 — wszystkie `todo`.
- Poprawki z UAT E-01 nadal otwarte: T-052 (flake `57P01` w CI), T-066 (pusty `h1` SC-06), T-067 („Wszystko kupione” na pustej liście SC-05), T-068 (alert CodeQL w teście); T-047 zablokowane.
- Staging usypia po kilku minutach bez ruchu; pierwsze żądanie trwa kilka sekund.
- Poza zakresem: aplikacja mobilna (E-04), produkcja (E-03).

## Wynik

<Uzupełnia `/qa-task E-02` po potwierdzeniu przez właściciela.>
