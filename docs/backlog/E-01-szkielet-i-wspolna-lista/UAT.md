# UAT E-01 Szkielet i pierwsza wspólna lista

Przygotował: QA (po T-010), 2026-10-29. Wykonuje: właściciel. Miejsce: staging `https://lista-staging.fly.dev` (workflow bez środowisk podglądowych — `docs/architecture/tech-stack.md`, „Git workflow”). Kolejność przed UAT: `/review-change E-01`, `/security-review E-01`, potem `/qa-task E-01`.

## Przed UAT (warunki z tego epiku)

- [ ] Gałąź epiku wypchnięta, staging zawiera jej ostatni commit (obecnie wdrożony `:813ad14…`; po kolejnych commitach — nowe wdrożenie).
- [ ] `ci-ok` na PR #1 zielony. Stan na 2026-10-29: czerwony z powodu niestabilnego testu `apps/web/src/screens/SC-08-zaproszenie/InvitationScreen.entry.test.tsx` (patrz „Znane ograniczenia”), a informacyjny check „CodeQL” z powodu alertu `js/missing-rate-limiting` w `apps/api/test/unexpected-error.test.ts`.
- [ ] Warunek z `docs/architecture/deployment.md`: wyzwalacz `push` w `.github/workflows/deploy.yml` wraca do samego `[main]` (razem z testem `scripts/test/deploy-workflow.test.sh`), gałęzie `deploy-test/T-010` i `deploy-test/T-010-zla-migracja` usunięte, obraz `ghcr.io/tombraz/lista-zakupow:91c62fd…` (celowo błędna migracja) usunięty z GHCR.

## Kroki

Przygotuj trzy adresy e-mail testowe (A, B, C), komputer z przeglądarką i telefon.

1. [ ] **Staging działa.** Otwórz `https://lista-staging.fly.dev` na komputerze. Jeśli maszyna spała, pierwsze otwarcie może trwać kilka sekund. Oczekiwane: strona logowania lub start, kłódka HTTPS bez ostrzeżeń. Wpisz `http://lista-staging.fly.dev` — przeglądarka przechodzi na `https://`.
2. [ ] **Konto A (komputer).** Załóż konto A (imię, e-mail, hasło, zgody). Oczekiwane: jesteś zalogowany, widzisz pusty stan „Moje listy”.
3. [ ] **Lista.** Utwórz listę „Dom”, dodaj pozycje „Mleko” i „Chleb”. Spróbuj dodać „mleko” jeszcze raz. Oczekiwane: ostrzeżenie o duplikacie, pozycja nie powiela się. Przy pozycji widać, kto ją dodał.
4. [ ] **Zaproszenie.** Jako A utwórz link zaproszenia do „Dom” i wyślij go sobie na telefon.
5. [ ] **Konto B (telefon).** Na telefonie otwórz link, wybierz „Załóż konto i dołącz”, załóż konto B. Oczekiwane: od razu lista „Dom” z komunikatem o dołączeniu; widać „Mleko” i „Chleb”.
6. [ ] **Ponowne użycie linku.** Wyloguj się na telefonie (albo użyj okna prywatnego) i otwórz ten sam link jeszcze raz. Oczekiwane: „Ten link nie działa”.
7. [ ] **Na żywo (≤ 5 s).** Obie osoby mają otwartą „Dom”. Na telefonie (B) dodaj „Masło” — na komputerze (A) pojawia się w ≤ 5 s bez odświeżania. Na komputerze odhacz „Chleb” — na telefonie widać odhaczenie i kto kupił w ≤ 5 s. Na telefonie usuń „Mleko” — znika na komputerze w ≤ 5 s.
8. [ ] **Trzecie konto nie widzi listy.** W trzeciej przeglądarce (lub oknie prywatnym) załóż konto C. Skopiuj od A adres listy „Dom” (`/listy/<id>`) i otwórz go jako C. Oczekiwane: brak treści listy (komunikat o braku dostępu / nie znaleziono). Zmieniaj pozycje jako A — C nic nie widzi.
9. [ ] **Wylogowanie.** Wyloguj A. Oczekiwane: powrót do logowania; adres listy po wylogowaniu prowadzi do logowania.
10. [ ] **CI blokuje zepsuty test.** Wypchnij na gałąź testową PR z celowo zepsutym testem (np. zmieniona oczekiwana wartość w dowolnym teście). Oczekiwane: `ci-ok` czerwony, merge zablokowany. Zamknij ten PR i usuń gałąź.
11. [ ] **Mobile.** W CI epiku job `mobile-android` (Maestro) zielony; lokalnie na emulatorze Androida (`docs/architecture/layers/mobile.md`, „Komendy”) aplikacja startuje i pokazuje stan API.
12. [ ] **Wdrożenie po merge (po UAT, przy merge do `main`).** Po merge przebieg `Deploy` z `main`: joby `image`, `staging`, `zap` zielone; staging pokazuje nową wersję.

## Znane ograniczenia

- **Niestabilny test SC-08** (`InvitationScreen.entry.test.tsx`): w „sign up … lands on the list” klient czasem wysyła dodatkowo `POST /api/v1/invitations/<token>/accept` po rejestracji z zaproszeniem; w CI inny test tego pliku (`toHaveFocus`). Może to być realny podwójny „accept” w kroku 5 — obserwuj, czy po rejestracji przez link nie pojawia się błąd. Proponowany task naprawczy przed UAT.
- Alert CodeQL `js/missing-rate-limiting` w pliku testowym `apps/api/test/unexpected-error.test.ts` (check „CodeQL” czerwony; wymagany `codeql` zielony).
- Staging usypia po kilku minutach bez ruchu; pierwsze żądanie ~6–7 s. Pierwsze żądanie API po uśpieniu bazy Neon może raz zwrócić błąd (pula API 3 s).
- Wyścig `subscribe` ↔ `revoke` na WebSocket i połączenie WS żyjące po wygaśnięciu sesji (QA T-009) — do zamknięcia przed S-02-02.
- Redakcja tokenu zaproszenia w logach wrażliwa na wielkość liter i podwójne ukośniki (QA T-008).
- SC-06: pusty `h1` w stanach ładowania i błędu; brak fokusu w polu dodawania na pustej liście; SC-05 pokazuje „Wszystko kupione” na pustej liście.
- Ręczne sprawdzenia dostępności (czytnik ekranu, tylko klawiatura, powiększenie 200 %) i Safari na iPhonie nie były wykonane przez QA — sprawdź przy krokach 5–7 na telefonie.
- Poza zakresem epiku: reset hasła, usuwanie konta, uczestnicy, pasek „brak połączenia” (E-02); produkcja, monitoring, kopie (E-03); ekrany mobile (E-04).

## Wynik

<Uzupełnia `/qa-task E-01` po przejściu kroków z właścicielem: pass / fail z komentarzem dla każdego kroku i data potwierdzenia.>
