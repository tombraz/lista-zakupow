---
status: approved       # draft | approved
approved: 2026-10-26
source_direction: B · Sklep, z polem dodawania na dole i wierszami ~60 px (z A) — zob. design-decisions.md
design_tool: repo       # repo | claude-design (same as design-decisions.md)
artifact:              # claude-design only: link to the Design System artifact
imported:              # claude-design only: date of the last import
---

# Design system

## Zasady

1. **Telefon w sklepie jest głównym przypadkiem.** Jedna ręka, ruch, słaby wzrok na ekran: duże cele, wysoki kontrast, najczęstsze akcje (odhacz, dopisz) pod kciukiem.
2. **Lista ponad ozdoby.** Pasek marki i przyciski nie konkurują z pozycjami; na ekranie listy mieści się ok. 7 pozycji.
3. **Stan zawsze prawdziwy.** Nie pokazujemy zmiany jako zapisanej, dopóki nie jest zapisana (F-15); brak połączenia jest widoczny, nie ukryty.
4. **Jedna droga do każdej akcji, bez gestów.** Żadnego przeciągania ani przesuwania; każda akcja to przycisk.
5. **Kto — zawsze z imieniem.** Kolor awatara pomaga, ale osoba jest zawsze podpisana imieniem (kolor nie niesie informacji sam).

## Tokeny

Źródło prawdy: `docs/design/tokens.json` (format W3C design-tokens: `$type`, `$value`). Tylko tryb jasny — brak `tokens.dark.json` (decyzja w `design-decisions.md`). Kod platformy korzysta z tokenów, nigdy nie wpisuje wartości na sztywno; pilnuje tego `node scripts/design-check.mjs --scan <katalogi UI>`.

### Kolor (semantyczny)

| Token | Jasny | Ciemny | Użycie |
| --- | --- | --- | --- |
| color.bg.default | #ffffff | — | tło ekranu, wiersze, karty |
| color.bg.subtle | #f1f5f9 | — | nagłówek „Kupione”, pole linku zaproszenia |
| color.bg.overlay | rgba(15,23,42,.5) | — | przyciemnienie pod arkuszem / dialogiem |
| color.surface.brand | #0b4fbf | — | pasek nagłówka, pasek dodawania |
| color.surface.brand-control | #2a64c7 | — | przyciski-ikony na pasku marki |
| color.surface.inverse | #0f172a | — | pasek „brak połączenia”, komunikat chwilowy |
| color.text.primary | #0f172a | — | tekst podstawowy |
| color.text.secondary | #475569 | — | notatka, „dodał(a)…”, opisy |
| color.text.muted | #64748b | — | nazwa odhaczonej pozycji |
| color.text.on-brand | #ffffff | — | tekst i ikony na pasku marki i przycisku głównym |
| color.text.on-accent | #0f172a | — | tekst na przycisku „Dodaj” |
| color.text.on-inverse | #ffffff | — | tekst na pasku „brak połączenia” |
| color.text.on-person | #ffffff | — | inicjały w awatarze |
| color.action.primary | #0b4fbf | — | przyciski główne, checkbox, linki |
| color.action.primary-hover | #093f99 | — | najechanie / wciśnięcie |
| color.action.accent | #ffd23f | — | przycisk „Dodaj” na pasku marki |
| color.action.accent-hover | #f5c400 | — | najechanie / wciśnięcie |
| color.action.danger | #b91c1c | — | usuń, opuść, unieważnij |
| color.action.disabled | #cbd5e1 | — | tło nieaktywnego przycisku |
| color.status.done | #15803d | — | odhaczony checkbox |
| color.status.warning-bg / -text | #fff4cc / #5c4300 | — | ostrzeżenie (duplikat, limit) |
| color.status.error-bg / -text | #fde8e8 / #8a1414 | — | błąd zapisu, błąd formularza |
| color.status.success-bg / -text | #dcfce7 / #14532d | — | potwierdzenie (np. „Hasło zmienione”) |
| color.border.default | #e2e8f0 | — | linie między wierszami (dekoracyjne) |
| color.border.input | #64748b | — | obramowanie pól i checkboxów zgód |
| color.focus.ring | #0b4fbf | — | obwódka fokusu na jasnym tle |
| color.focus.ring-on-brand | #ffd23f | — | obwódka fokusu na pasku marki |
| color.person.1 … 6 | #0b4fbf, #b4235a, #0f766e, #6d28d9, #b45309, #475569 | — | tło awatara; kolor przypisany osobie stale w obrębie listy |

### Typografia

Rodzina: `typography.family.base` (systemowa bezszeryfowa). Rozmiary w px skalują się z ustawieniem rozmiaru tekstu przeglądarki/systemu (implementacja w `rem`).

| Token | Rozmiar / interlinia | Grubość | Użycie |
| --- | --- | --- | --- |
| typography.size.title-lg | 24 / 1.25 | bold | tytuł ekranów logowania, rejestracji, resetu |
| typography.size.title | 20 / 1.25 | bold | tytuł w pasku, nazwa karty listy |
| typography.size.item | 18 / 1.25 | semibold | nazwa pozycji; tekst w polach (≥16 px zapobiega powiększaniu na iOS) |
| typography.size.body | 16 / 1.5 | regular | tekst ogólny, przyciski |
| typography.size.small | 14 / 1.5 | regular | notatka, „dodał(a)…”, opisy pól |

### Odstępy, promienie, rozmiary, cienie, ruch

| Grupa | Wartości | Uwagi |
| --- | --- | --- |
| spacing | xs 4 · sm 8 · md 12 · lg 16 · xl 24 · 2xl 32 | margines boczny ekranu: lg (16) |
| size | target-min 48 · item-row 60 · checkbox 40 (obszar dotyku 48) · avatar 32 · content-max 560 | na komputerze kolumna wyśrodkowana, max 560 px |
| radius | sm 8 · md 10 · lg 14 · full | pola i przyciski md, karty i arkusz lg, awatar full |
| elevation | sheet · toast | tylko arkusz i komunikat chwilowy mają cień |
| motion | fast 120 ms · normal 200 ms | wyłączane przy „ogranicz ruch” |
| focus | width 3 · offset 2 | zob. zasady dostępności |

## Komponenty

### Pasek nagłówka (AppBar)
- **Używany na:** SC-05, SC-06, SC-07, SC-09 (SC-01–SC-04 i SC-08 mają sam tytuł na jasnym tle)
- **Warianty:** z przyciskiem „Wstecz” / bez; 0–2 przyciski-ikony po prawej (Uczestnicy, Więcej, Konto)
- **Stany:** domyślny; tytuł zawinięty do 2 linii, potem skrócony z wielokropkiem
- **Dostępność:** tytuł paska to nagłówek `h1` ekranu; przyciski-ikony mają nazwę dostępną („Wstecz”, „Uczestnicy”, „Więcej opcji”, „Konto”); cel 48 × 48; fokus `focus.ring-on-brand`
- **Robić / nie robić:** maks. 2 ikony; akcje rzadkie (zmień nazwę, usuń listę) w menu „Więcej”, nie w pasku

### Przycisk (Button)
- **Używany na:** wszystkie ekrany
- **Warianty:** główny (`action.primary`, tekst `on-brand`), drugorzędny (obramowanie `action.primary`, tło `bg.default`), niebezpieczny-tekstowy (`action.danger` bez tła), akcentowy „Dodaj” (`action.accent`, tylko na pasku dodawania)
- **Stany:** domyślny, hover, fokus, wciśnięty, nieaktywny (`action.disabled`, tekst `text.secondary`), ładowanie (etykieta zostaje, obok wskaźnik; przycisk nieaktywny)
- **Dostępność:** natywny `button`; min. wysokość 48; etykieta zawsze tekstem („+” w „Dodaj” ma nazwę dostępną „Dodaj pozycję”)
- **Robić / nie robić:** jeden przycisk główny na ekran; akcja nieodwracalna nigdy jako przycisk główny bez potwierdzenia

### Przycisk-ikona (IconButton)
- **Używany na:** AppBar, wiersz uczestnika
- **Warianty:** na pasku marki (`surface.brand-control`), na jasnym tle (bez tła)
- **Stany:** domyślny, hover, fokus, wciśnięty
- **Dostępność:** nazwa dostępna obowiązkowa; cel 48 × 48

### Pole tekstowe (TextField)
- **Używany na:** SC-01, SC-02, SC-03, SC-05 (nowa lista), SC-06 (dodawanie, edycja), SC-09 (imię)
- **Warianty:** standardowe (etykieta nad polem), na pasku marki (etykieta `text.on-brand`, pole białe)
- **Stany:** domyślny, fokus, wypełniony, błąd (obramowanie i tekst błędu `status.error-text` pod polem + ikona), nieaktywny
- **Dostępność:** zawsze widoczna etykieta (placeholder tylko jako przykład); błąd powiązany z polem i ogłaszany; `autocomplete` dla e-maila, nowego/bieżącego hasła, imienia; wklejanie i menedżery haseł działają; licznik znaków pokazywany od 80% limitu (100 / 200 / 30)
- **Robić / nie robić:** komunikat błędu mówi, co poprawić („Nazwa może mieć najwyżej 100 znaków”), nie „Błąd”

### Pole hasła (PasswordField)
- **Używany na:** SC-01, SC-02, SC-03
- **Warianty:** bieżące hasło, nowe hasło (z podpowiedzią „co najmniej 8 znaków”)
- **Stany:** jak TextField + przełącznik „Pokaż / ukryj hasło”
- **Dostępność:** przełącznik jako `button` z `aria-pressed`; bez blokady wklejania (WCAG 3.3.8)

### Checkbox zgody (ConsentCheckbox)
- **Używany na:** SC-02
- **Warianty:** regulamin i polityka prywatności (z linkami do SC-04), wiek 16+
- **Stany:** niezaznaczony, zaznaczony, fokus, błąd (gdy formularz wysłany bez zgody)
- **Dostępność:** natywny `input type=checkbox` z `label`; obszar dotyku całej etykiety ≥ 48 wysokości

### Wiersz pozycji (ItemRow)
- **Używany na:** SC-06
- **Warianty:** nieodhaczona; odhaczona (nazwa `text.muted` z przekreśleniem, checkbox `status.done` z ✓, podpis „kupił(a) <imię>”)
- **Budowa:** awatar osoby (dodał / odhaczył) · nazwa (`size.item`) + linia `size.small`: „<ilość/notatka> · dodał(a) <imię>” · checkbox po prawej (40 widoczne / 48 dotyk)
- **Stany:** domyślny, fokus, zapisywanie (checkbox z wskaźnikiem; pozycja nie zmienia sekcji do potwierdzenia zapisu), błąd zapisu (wraca do poprzedniego stanu + komunikat), właśnie zmieniona przez inną osobę (krótkie podświetlenie `bg.subtle`, wyłączane przy „ogranicz ruch”)
- **Dostępność:** checkbox to `button` z `aria-pressed` i nazwą „Odhacz <nazwa>” / „Odznacz <nazwa>”; nazwa pozycji to osobny `button` „Edytuj <nazwa>” otwierający arkusz edycji; min. wysokość wiersza 60
- **Robić / nie robić:** żadnego przesuwania palcem do usunięcia; usuwanie tylko w arkuszu edycji

### Awatar (Avatar)
- **Używany na:** SC-05 (stos na karcie listy), SC-06, SC-07
- **Warianty:** 32 px (wiersz), 28 px w stosie z obwódką `bg.default`
- **Dostępność:** dekoracyjny (`aria-hidden`), bo imię jest zawsze obok w tekście; kolor `person.N` przydzielany kolejno wg dołączenia do listy
- **Robić / nie robić:** nie używać koloru jako jedynego wyróżnika osoby

### Karta listy (ListCard)
- **Używany na:** SC-05
- **Budowa:** nazwa (`size.title`) · „N do kupienia” · „od <imię właściciela>” dla list udostępnionych · stos awatarów uczestników
- **Stany:** domyślny, fokus, wciśnięty
- **Dostępność:** cała karta to jeden link; nazwa dostępna = nazwa listy + „udostępniona przez <imię>” + „N do kupienia”

### Pasek dodawania (AddBar)
- **Używany na:** SC-06
- **Budowa:** przyklejony do dołu ekranu, tło `surface.brand`; pole „Co kupić?” + przycisk „Dodaj” (akcent); pole „Ilość / notatka” pojawia się po wpisaniu nazwy
- **Stany:** pusty, wpisywanie, duplikat (komunikat ostrzegawczy nad polami, pozycja niedodana, wpisany tekst zostaje), limit 500 (pole nieaktywne + komunikat), zapisywanie, brak połączenia (przycisk nieaktywny)
- **Dostępność:** Enter dodaje; po dodaniu fokus wraca do pola nazwy; ostrzeżenie ogłaszane (`role="alert"`); pasek nie zasłania pola z fokusem ani ostatniej pozycji (lista ma dolny margines równy wysokości paska) — WCAG 2.4.11

### Sekcja zwijana „Kupione” (CollapsibleSection)
- **Używany na:** SC-06
- **Stany:** zwinięta (domyślnie), rozwinięta; licznik „Kupione (N)”; po rozwinięciu przycisk „Usuń wszystkie kupione” (niebezpieczny)
- **Dostępność:** `button` z `aria-expanded`; cel ≥ 48 wysokości

### Arkusz edycji pozycji (BottomSheet)
- **Używany na:** SC-06
- **Budowa:** tytuł „Edytuj pozycję” · pola nazwa i ilość/notatka · „Zapisz” (główny) · „Usuń pozycję” (niebezpieczny-tekstowy) · „Anuluj”
- **Stany:** otwarty, zapisywanie, błąd walidacji, duplikat nazwy (F-09), pozycja usunięta w międzyczasie przez inną osobę (komunikat i zamknięcie)
- **Dostępność:** modalny dialog (`role="dialog"`, `aria-modal`), fokus na polu nazwy, pułapka fokusu, Esc zamyka, po zamknięciu fokus wraca do edytowanej pozycji (albo do następnej po usunięciu)

### Okno potwierdzenia (ConfirmDialog)
- **Używany na:** SC-06 (usuń listę, usuń kupione), SC-07 (usuń uczestnika, opuść listę), SC-09 (usuń konto)
- **Budowa:** tytuł-pytanie, jedno zdanie skutku, przycisk akcji niebezpiecznej z czasownikiem („Usuń listę”), „Anuluj”
- **Dostępność:** `role="alertdialog"`, fokus startowy na „Anuluj”, Esc = Anuluj, po zamknięciu fokus wraca do przycisku wywołującego

### Komunikat w treści (InlineAlert)
- **Używany na:** SC-01–SC-09
- **Warianty:** ostrzeżenie (`status.warning-*`), błąd (`status.error-*`), sukces (`status.success-*`), informacja (`bg.subtle`, `text.primary`)
- **Dostępność:** ikona + tekst (nie sam kolor); błędy `role="alert"`, pozostałe `role="status"`

### Pasek „brak połączenia” (OfflineBanner)
- **Używany na:** SC-05–SC-09
- **Budowa:** pod paskiem nagłówka, tło `surface.inverse`: „Brak połączenia. Zmiany nie są zapisywane.”
- **Dostępność:** `role="status"`; pojawienie i zniknięcie ogłaszane; nie zasłania treści (przesuwa ją)

### Komunikat chwilowy (Toast)
- **Używany na:** SC-07 („Link skopiowany”), SC-09 („Imię zmienione”)
- **Dostępność:** `role="status"`; znika po 5 s, ale nie zawiera akcji (nic, czego nie da się zrobić gdzie indziej)

### Pole linku zaproszenia (InviteLinkBox)
- **Używany na:** SC-07
- **Budowa:** opis „Link jednorazowy, ważny do <data>” · link (do zaznaczenia) · „Kopiuj” · „Unieważnij”
- **Dostępność:** „Kopiuj” potwierdza komunikatem chwilowym; link w polu tylko do odczytu, by dało się go zaznaczyć ręcznie

### Pusty stan (EmptyState)
- **Używany na:** SC-05 (brak list), SC-06 (lista bez pozycji)
- **Budowa:** jedno zdanie + jeden przycisk / wskazanie pola dodawania; bez ilustracji

### Wskaźnik ładowania (Loading)
- **Używany na:** SC-05, SC-06, SC-07, SC-08
- **Warianty:** szkielet wierszy (lista), wskaźnik w przycisku
- **Dostępność:** `aria-busy` na kontenerze; animacja wyłączana przy „ogranicz ruch”

## Zasady dostępności

- Cel: WCAG 2.2 AA (checklista: `.claude/skills/brd-to-design/references/accessibility.md`)
- Fokus: obwódka 3 px, odstęp 2 px; `color.focus.ring` na jasnym tle, `color.focus.ring-on-brand` na pasku marki; widoczna w każdym stanie (także hover, wciśnięty); pasek nagłówka i pasek dodawania nie zasłaniają elementu z fokusem (przewijanie z marginesem)
- Minimalny cel dotyku: 48 × 48 CSS px dla wszystkich elementów interaktywnych (powyżej minimum WCAG 24 × 24, bo głównym urządzeniem jest telefon)
- Przeciąganie i jego alternatywy: brak akcji przeciągania i przesuwania palcem
- Ruch: przejścia 120–200 ms; przy „ogranicz ruch” (`prefers-reduced-motion`) brak animacji przeniesienia pozycji, podświetlenia zmian i szkieletów
- Szerokość 320 px i 200% tekstu: jedna kolumna, nic nie jest ucinane; nazwy pozycji się zawijają
- Orientacja: pionowa i pozioma
- Komunikaty statusu (dodano, zapisano, brak połączenia, zmiana od innej osoby nie jest ogłaszana każdorazowo — tylko licznik „N do kupienia” jest regionem `polite`)
- Klawiatura i czytnik ekranu: zasady per komponent powyżej

### Contrast pairs

| Foreground | Background | Use |
| --- | --- | --- |
| color.text.primary | color.bg.default | text |
| color.text.primary | color.bg.subtle | text |
| color.text.secondary | color.bg.default | text |
| color.text.secondary | color.bg.subtle | text |
| color.text.muted | color.bg.default | text |
| color.text.on-brand | color.surface.brand | text |
| color.text.on-brand | color.surface.brand-control | ui |
| color.text.on-brand | color.action.primary | text |
| color.text.on-brand | color.action.primary-hover | text |
| color.text.on-accent | color.action.accent | text |
| color.text.on-accent | color.action.accent-hover | text |
| color.action.accent | color.surface.brand | ui |
| color.bg.default | color.surface.brand | ui |
| color.action.primary | color.bg.default | text |
| color.action.primary | color.bg.subtle | text |
| color.action.danger | color.bg.default | text |
| color.action.danger | color.bg.subtle | text |
| color.text.secondary | color.action.disabled | text |
| color.status.done | color.bg.default | ui |
| color.text.on-brand | color.status.done | ui |
| color.status.warning-text | color.status.warning-bg | text |
| color.status.error-text | color.status.error-bg | text |
| color.status.error-text | color.bg.default | text |
| color.status.success-text | color.status.success-bg | text |
| color.text.on-inverse | color.surface.inverse | text |
| color.border.input | color.bg.default | ui |
| color.focus.ring | color.bg.default | ui |
| color.focus.ring | color.bg.subtle | ui |
| color.focus.ring-on-brand | color.surface.brand | ui |
| color.text.on-person | color.person.1 | text |
| color.text.on-person | color.person.2 | text |
| color.text.on-person | color.person.3 | text |
| color.text.on-person | color.person.4 | text |
| color.text.on-person | color.person.5 | text |
| color.text.on-person | color.person.6 | text |

## Uwagi platformowe

Technologia stylowania nie jest jeszcze wybrana (`design-decisions.md`); rozstrzygnie ją `/tech-architecture` i uzupełni tę tabelę.

| Platform | Generated from tokens.json by | Output path (excluded from the hard-coded check with `--allow`) | UI source dirs (`--scan`) |
| --- | --- | --- | --- |
| web | do ustalenia w `/tech-architecture` | do ustalenia | do ustalenia |
