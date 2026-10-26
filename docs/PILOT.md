# Pilotaż zestawu skilli

Cel: sprawdzić cały proces na małym, prawdziwym projekcie, zanim użyjesz go do czegoś ważnego. Pilotaż nie ocenia aplikacji, tylko **skille**: gdzie agent zrobił coś innego, niż zakłada instrukcja, gdzie brakowało informacji, gdzie proces był za ciężki.

## Projekt pilotażowy

Zasady doboru: jeden epik, 5–8 tasków, wszystkie warstwy twojego typowego stacku, coś, czego realnie użyjesz (inaczej nie będziesz uczciwie testować).

**Rekomendowany: „Wspólna lista zakupów”**
- Konto i logowanie, lista, dodawanie i odhaczanie pozycji, udostępnienie listy drugiej osobie.
- Dotyka bazy, backendu, web i mobile, ma uprawnienia (kto widzi czyją listę) i jedną ścieżkę współdzielenia, czyli dokładnie te miejsca, gdzie procesy się sypią.
- Celowo nudny produkt: nie rozprasza wymyślaniem funkcji.

Alternatywy:
- **Tracker nawyków** — prostszy (bez współdzielenia), szybszy pilotaż, słabiej testuje uprawnienia.
- **Pilotaż brownfield** — po greenfield, na istniejącym projekcie (np. starej stronie do odświeżenia): `/adopt-codebase` + jedna zmiana + jeden `/fix`.

Ogranicz zakres z góry: w BRD tylko MVP pierwszego epika, wszystko inne w „Out of scope”.

## Przebieg

| # | Krok | Co celowo sprawdzić |
| --- | --- | --- |
| 1 | `/concept-to-brd` | Czy ocena była krytyczna (wskazała słabości i funkcje „nie warto”)? Czy do BRD trafiło coś, czego nie powiedziałeś? |
| 2 | `/brd-to-design` (wariant `claude-design`) | Czy kierunki wizualne naprawdę się różniły? Czy design system wynika z wybranego kierunku? Czy brief wystarczył Claude w aplikacji bez dopytywania? **Czy eksport przeszedł import bez ręcznego poprawiania tokenów** (jeśli nie: zapisz, co trzeba było poprawić)? Czy `design-check` przechodzi? |
| 3 | `/tech-architecture` | Czy zapytał o stack mimo wcześniejszych projektów? Czy przewodniki warstw są krótkie i konkretne? |
| 4 | `/ci-cd` | Czy ceny miały źródła i daty? Czy rekomendacja hostingu była uzasadniona, a nie „popularna”? |
| 5 | `/plan-backlog` | Czy taski są pionowe (każdy da się pokazać)? Czy `depends_on` ma sens? Czy skrypt przechodzi? |
| 6 | Pierwsze 2 taski ręcznie: `/implement-task` → `/qa-task` (osobne sesje) | Czy test był naprawdę przed kodem (sprawdź historię commitów i dowód „czerwonej” fazy)? Czy QA znalazło coś realnego? |
| 7 | Reszta przez `/build-epic` | Czy orkiestrator nie czytał kodu? Czy pytania subagentów dotarły do ciebie i wróciły po odpowiedzi? |
| 7b | Tryb i uprawnienia | Pracuj w auto mode. Czy `/build-epic` przeszedł epik bez blokad klasyfikatora? Jeśli były, zapisz które akcje (komenda, powód). Czy reguły z `.claude/settings.json` zadziałały: próba odczytu `.env` odrzucona, `git push` z pytaniem? |
| 7c | Git | Czy `/build-epic` założył branch epiku i szkic PR, a CI ruszyło po pushu na postoju? Czy kolejność odbioru (przeglądy, UAT, merge, akceptacja produkcji) była jasna bez zaglądania do README? |
| 8 | Test przerwania | W środku `/build-epic` zamknij sesję. Nowa sesja + `/build-epic`: czy wznowił bez strat? |
| 9 | Test QA | Przed jednym przekazaniem do QA podmień ręcznie jedną linię logiki na błędną (zapisz którą). Czy QA to wyłapało? |
| 10 | `/fix` | Zgłoś prawdziwy albo celowo wprowadzony błąd. Czy najpierw powstał test odtwarzający? Czy zaproponował zapobieganie? |
| 10b | Bezpieczeństwo | Czy model zagrożeń zawiera „inny użytkownik czyta cudzą listę”? Czy task współdzielenia ma test negatywny? Przed jednym przekazaniem do QA usuń sprawdzenie uprawnień w jednym endpoincie (zapisz którym): czy QA albo `/security-review` to wyłapało? |
| 10c | `/security-review E-01` | Czy próbował ataków z drugim kontem? Czy raport ma werdykt i czy UAT był zablokowany do czasu „pass”? |
| 10d | `/review-change E-01` | Co znalazł przegląd epiku, czego nie znalazło QA w pojedynczych taskach (spójność, duplikacja, rozjazd z architekturą)? Zapisz to w dzienniku: od tego zależy, czy przepiąć review w QA na `/review-change`. |
| 10e | Design w kodzie | Przed jednym przekazaniem do QA wpisz w komponencie kolor na sztywno zamiast tokenu. Czy QA albo `/review-change` to wyłapało? |
| 10f | Dostępność | Ustaw w tokenach jeden kolor tekstu tuż pod progiem (np. #777777 na białym, 4,48:1): czy `design-check` zatrzymał build? W jednym tasku usuń etykietę pola formularza: czy test automatyczny albo QA to wyłapało? Przejdź główny przepływ samą klawiaturą i czytnikiem ekranu. |
| 10g | Jakość kodu | Czy w historii tasków widać refaktoryzację po zielonych testach (bez zmian asercji)? Czy CI ma działające sprawdzanie duplikatów, złożoności i kierunku zależności? Czy QA albo `/review-change` wskazało choć raz nadmiarową abstrakcję, nie tylko duplikację? |
| 11 | UAT epika | Przejdź `UAT.md`. Czy kroki są wykonalne bez czytania kodu? |
| 12 | `/product-status` w kilku momentach | Czy zawsze wskazał właściwą następną komendę? |

## Dziennik obserwacji

Prowadź na bieżąco w `docs/pilot-log.md`. Jedna linia na każdą sytuację, gdy coś poszło inaczej niż zakłada skill.

| Data | Skill / krok | Co się stało | Oczekiwane | Typ | Waga |
| --- | --- | --- | --- | --- | --- |

**Typ:**
- `instrukcja` — skill mówi niejasno, sprzecznie albo czegoś brakuje,
- `posłuszeństwo` — skill mówi jasno, agent zrobił inaczej,
- `koszt` — działa, ale za wolno, za drogo albo za dużo pytań,
- `proces` — krok niepotrzebny albo brakujący.

**Waga:** wysoka (zła jakość mogła przejść dalej), średnia (strata czasu), niska (kosmetyka).

## Pomiary

| Miara | Jak zmierzyć | Wynik |
| --- | --- | --- |
| Czas na etap (1–5) | zegar | |
| Liczba pytań do ciebie w `/build-epic` | `progress.md` (NEEDS_USER) | |
| Rundy QA na task (średnio, maks.) | sekcje `## QA round` | |
| Taski, w których test nie był pierwszy | historia commitów + dowody | |
| Błędy znalezione przez QA / przepuszczone | raporty QA + test z kroku 9 | |
| Zużycie tokenów na task | podsumowanie kosztów sesji w Claude Code | |
| Ile razy `/product-status` wskazał źle | dziennik | |

## Kryteria sukcesu

Zestaw jest gotowy do prawdziwych projektów, gdy:

- żadna obserwacja o wadze „wysoka” nie została bez poprawki,
- w ≥ 90% tasków test powstał przed kodem,
- QA wyłapało błąd z kroku 9, a QA lub `/security-review` wyłapało usunięte sprawdzenie uprawnień z kroku 10b,
- kolor na sztywno z kroku 10e został wyłapany, a import z Claude Design nie wymagał ręcznego poprawiania tokenów (inaczej: popraw brief albo przejdź na wariant `repo`),
- wznowienie po przerwaniu (krok 8) zadziałało bez ręcznej naprawy,
- nie było momentu, w którym nie wiedziałeś, jaka jest następna komenda.

## Po pilotażu

1. Pogrupuj obserwacje według skilla i typu.
2. `instrukcja` → popraw `SKILL.md`. `posłuszeństwo` (powtarzające się) → zamień regułę w mechanizm: skrypt, hook albo krok CI, zamiast dopisywać zdania. `proces` → usuń albo dodaj krok. `koszt` → przytnij to, co agent czyta.
3. Dla 2–3 najważniejszych zachowań (np. „test przed kodem”, „orkiestrator nie czyta kodu”) przygotuj testy skilli (evals) skillem `skill-creator`, żeby kolejne poprawki ich nie zepsuły.
4. Zdecyduj na podstawie danych, które z odłożonych pomysłów są potrzebne: twarde blokady (hooki), modelowanie zagrożeń, budżety wydajności, przegląd po wydaniu.
