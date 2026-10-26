---
title: Wspólna lista zakupów — Business Requirements
status: approved         # draft | approved
ui: yes                  # yes | none (no user interface: design stage is skipped)
profile: greenfield      # greenfield | brownfield (set by /adopt-codebase)
change:                  # brownfield only: current change ID, C-00 = adoption, C-01, C-02 …
version: 1.3
approved: 2026-10-26     # YYYY-MM-DD, filled only on explicit approval
---

# Wspólna lista zakupów — Business Requirements

## 1. Podsumowanie

Wspólna lista zakupów to aplikacja dostępna z komputera i telefonu, dla osób mieszkających razem i robiących wspólnie zakupy. Każdy domownik ma własne konto, tworzy listy, dodaje i odhacza pozycje oraz może udostępnić listę kilku osobom, które widzą zmiany na bieżąco. Aplikacja zastępuje kartkę papieru, przez którą domownicy kupują coś podwójnie albo zapominają o rzeczach dopisanych przez innych. Projekt jest pilotażem procesu wytwarzania: pierwsza wersja obejmuje wyłącznie MVP realizowane jako jeden epik.

## 2. Problem i obecne obejście

Domownicy prowadzą listę zakupów na kartce. Kartka jest w jednym miejscu, więc osoba w sklepie nie widzi tego, co ktoś dopisał w domu, a dwie osoby robiące zakupy nie wiedzą, co kupiła druga. Skutek: zakupy podwójne i zapomniane.

## 3. Użytkownicy i persony

| Persona | Kim jest | Główny cel | Płaci? |
| --- | --- | --- | --- |
| Domownik | Osoba mieszkająca z innymi i współdzieląca zakupy; zakłada konto, tworzy listy lub dołącza do cudzych | Wiedzieć na bieżąco, co trzeba kupić i co już kupiono | Nie (aplikacja darmowa) |

Brak ról administracyjnych w aplikacji. Na każdej liście są dwie role: **właściciel** (twórca listy) i **uczestnik** (osoba, która przyjęła zaproszenie).

## 4. Propozycja wartości

W odróżnieniu od kartki lista jest jedna, aktualna i dostępna dla wszystkich domowników jednocześnie, w domu i w sklepie: dopisana pozycja i odhaczony zakup są widoczne dla pozostałych w ciągu 5 sekund, a aplikacja nie pozwala dopisać czegoś, co już jest na liście.

## 5. Główne ścieżki użytkownika

### J-01 Rejestracja i logowanie
1. Domownik zakłada konto (imię, e-mail, hasło, akceptacja regulaminu i polityki prywatności, potwierdzenie wieku 16+).
2. Loguje się na komputerze i na telefonie.
3. Gdy zapomni hasła, resetuje je linkiem z maila.

### J-02 Zarządzanie listami
1. Domownik widzi wszystkie swoje listy: własne i udostępnione mu.
2. Bez list widzi pusty stan z przyciskiem „Utwórz pierwszą listę”.
3. Tworzy listę, zmienia jej nazwę, usuwa ją (tylko właściciel).

### J-03 Pozycje na liście
1. Domownik dodaje pozycję (nazwa i opcjonalnie ilość/notatka); przy duplikacie widzi ostrzeżenie i pozycja nie zostaje dodana.
2. Edytuje lub usuwa pozycję.
3. W sklepie odhacza kupione pozycje; przypadkowe odhaczenie cofa.
4. Po zakupach usuwa wszystkie odhaczone pozycje.

### J-04 Udostępnianie listy
1. Właściciel generuje link zaproszenia i wysyła go domownikowi dowolnym kanałem.
2. Domownik otwiera link, loguje się lub zakłada konto i przyjmuje zaproszenie; lista pojawia się wśród jego list.
3. Właściciel widzi uczestników i może usunąć uczestnika; uczestnik może opuścić listę.

### J-05 Wspólne zakupy
1. Dwie lub więcej osób ma otwartą tę samą listę.
2. Zmiany każdej z nich (dodanie, edycja, odhaczenie, usunięcie) pojawiają się u pozostałych w ciągu maksymalnie 5 sekund, bez odświeżania.

## 6. Zakres pierwszego wydania (MVP)

Konta z e-mailem i hasłem, prywatne listy z pozycjami do odhaczania oraz udostępnianie listy kilku osobom przez jednorazowy link, ze zmianami widocznymi na bieżąco — na komputerze i telefonie, tylko po polsku, wyłącznie przy połączeniu z siecią.

## 7. Wymagania funkcjonalne

### F-01 Rejestracja konta
- **Persona:** Domownik
- **Description:** Domownik zakłada konto podając imię, e-mail i hasło, akceptując regulamin i politykę prywatności oraz potwierdzając, że ma ukończone 16 lat.
- **Origin:** new
- **Priority:** must
- **Journeys:** J-01, J-04
- **Business acceptance criteria:**
  - Given osoba bez konta, when poda imię, poprawny e-mail i hasło, zaakceptuje regulamin i politykę prywatności oraz potwierdzi wiek 16+, then konto zostaje założone i osoba jest zalogowana.
  - Given e-mail użyty już przez inne konto, when ktoś próbuje założyć konto z tym e-mailem, then rejestracja się nie udaje z czytelnym komunikatem.
  - Given osoba nie zaakceptowała regulaminu i polityki prywatności lub nie potwierdziła wieku, when próbuje założyć konto, then konto nie zostaje założone.
  - Given hasło krótsze niż 8 znaków albo puste imię lub dłuższe niż 30 znaków, when osoba próbuje założyć konto, then konto nie zostaje założone z czytelnym komunikatem.
  - Given osoba przyszła z linku zaproszenia, when zakończy rejestrację, then widzi od razu udostępnioną listę (zob. F-12).
- **Business rules:** Imię jest wymagane (1–30 znaków) i nie musi być unikalne. Hasło ma co najmniej 8 znaków, bez wymogu cyfr i znaków specjalnych. Rejestracja otwarta dla każdego. Regulamin i polityka prywatności są dostępne w aplikacji przed rejestracją. Masowe zakładanie kont jest ograniczane (MC-05).

### F-02 Logowanie i wylogowanie
- **Persona:** Domownik
- **Description:** Domownik loguje się e-mailem i hasłem na komputerze i na telefonie oraz wylogowuje się.
- **Origin:** new
- **Priority:** must
- **Journeys:** J-01
- **Business acceptance criteria:**
  - Given istniejące konto, when domownik poda poprawny e-mail i hasło, then jest zalogowany i widzi swoje listy.
  - Given błędny e-mail lub hasło, when domownik próbuje się zalogować, then logowanie się nie udaje, a komunikat nie zdradza, czy konto o tym e-mailu istnieje.
  - Given zalogowany domownik, when się wyloguje, then nie ma dostępu do list do czasu ponownego zalogowania.
  - Given wiele nieudanych prób logowania na to samo konto, when ktoś próbuje dalej, then kolejne próby są ograniczane (MC-04).
- **Business rules:** To samo konto działa jednocześnie na komputerze i telefonie.

### F-03 Reset hasła
- **Persona:** Domownik
- **Description:** Domownik, który zapomniał hasła, ustawia nowe za pomocą linku wysłanego na e-mail konta.
- **Origin:** new
- **Priority:** must
- **Journeys:** J-01
- **Business acceptance criteria:**
  - Given istniejące konto, when domownik poprosi o reset hasła dla swojego e-maila, then dostaje mail z linkiem do ustawienia nowego hasła.
  - Given dowolny e-mail, when ktoś poprosi o reset, then komunikat w aplikacji jest taki sam niezależnie od tego, czy konto istnieje.
  - Given link resetu został już użyty lub wygasł, when ktoś go otworzy, then nie może ustawić hasła.
- **Business rules:** Link resetu jest jednorazowy i ważny 1 godzinę. Nowe hasło ma co najmniej 8 znaków. To jedyny mail wysyłany przez aplikację. Prośby o reset są ograniczane, żeby nie dało się zalewać skrzynki (MC-04).

### F-04 Usunięcie konta
- **Persona:** Domownik
- **Description:** Domownik trwale usuwa swoje konto.
- **Origin:** new
- **Priority:** must
- **Journeys:** J-01
- **Business acceptance criteria:**
  - Given domownik jest właścicielem list, when usunie konto, then jego listy są usuwane, a ich uczestnicy tracą do nich dostęp.
  - Given domownik jest uczestnikiem cudzych list, when usunie konto, then zostaje z nich wypisany, a dodane przez niego pozycje zostają z podpisem „usunięty użytkownik”.
  - Given konto zostało usunięte, when ktoś spróbuje się na nie zalogować, then logowanie się nie udaje.
- **Business rules:** Usunięcie wymaga wyraźnego potwierdzenia. Eksport danych poza zakresem.

### F-05 Tworzenie, zmiana nazwy i usuwanie listy
- **Persona:** Domownik (właściciel)
- **Description:** Domownik tworzy listę i staje się jej właścicielem; właściciel zmienia nazwę listy i ją usuwa.
- **Origin:** new
- **Priority:** must
- **Journeys:** J-02
- **Business acceptance criteria:**
  - Given zalogowany domownik, when utworzy listę z nazwą, then lista pojawia się wśród jego list, a on jest jej właścicielem.
  - Given właściciel listy, when zmieni jej nazwę, then nowa nazwa jest widoczna u wszystkich uczestników.
  - Given właściciel listy, when usunie listę (po potwierdzeniu), then lista znika u właściciela i wszystkich uczestników.
  - Given uczestnik listy, when próbuje zmienić nazwę lub usunąć listę, then nie może tego zrobić.
  - Given nazwa listy pusta lub dłuższa niż 100 znaków, when właściciel próbuje ją zapisać, then zapis się nie udaje z czytelnym komunikatem.
  - Given domownik ma 50 list, when próbuje utworzyć kolejną, then widzi czytelny komunikat o limicie.
- **Business rules:** Nazwa listy: 1–100 znaków. Limit 50 list na konto (liczone listy, których jest właścicielem). Lista jest prywatna, dopóki właściciel jej nie udostępni.

### F-06 Przegląd list i pusty stan
- **Persona:** Domownik
- **Description:** Domownik widzi wszystkie listy, do których ma dostęp — własne i udostępnione mu — i odróżnia je od siebie.
- **Origin:** new
- **Priority:** must
- **Journeys:** J-02
- **Business acceptance criteria:**
  - Given domownik ma własne i udostępnione listy, when otworzy aplikację, then widzi wszystkie i wie, które są udostępnione mu przez innych.
  - Given domownik nie ma żadnej listy, when otworzy aplikację, then widzi jedno zdanie wyjaśnienia i przycisk „Utwórz pierwszą listę”.
  - Given domownik nie ma dostępu do danej listy, when spróbuje ją otworzyć (np. podmieniając adres), then nie widzi jej zawartości (MC-01).
- **Business rules:** Bez samouczka.

### F-07 Dodawanie, edycja i usuwanie pozycji
- **Persona:** Domownik (właściciel lub uczestnik)
- **Description:** Domownik z dostępem do listy dodaje pozycję (nazwa wymagana, ilość/notatka opcjonalna), edytuje ją i usuwa.
- **Origin:** new
- **Priority:** must
- **Journeys:** J-03, J-05
- **Business acceptance criteria:**
  - Given domownik z dostępem do listy, when doda pozycję z nazwą, then pozycja pojawia się na liście jako nieodhaczona.
  - Given pozycja na liście, when domownik zmieni jej nazwę lub ilość/notatkę, then zmiana jest zapisana i widoczna dla wszystkich z dostępem.
  - Given pozycja na liście, when domownik ją usunie, then znika u wszystkich z dostępem.
  - Given nazwa pusta lub dłuższa niż 100 znaków albo ilość/notatka dłuższa niż 200 znaków, when domownik próbuje zapisać pozycję, then zapis się nie udaje z czytelnym komunikatem.
  - Given lista ma 500 pozycji, when domownik próbuje dodać kolejną, then widzi czytelny komunikat o limicie.
- **Business rules:** Właściciel i uczestnicy mają te same prawa do pozycji. Kategorie, ceny, zdjęcia i sortowanie według działów sklepu poza zakresem.

### F-08 Odhaczanie pozycji i usuwanie odhaczonych
- **Persona:** Domownik (właściciel lub uczestnik)
- **Description:** Domownik odhacza kupioną pozycję, odznacza ją z powrotem i usuwa wszystkie odhaczone pozycje naraz.
- **Origin:** new
- **Priority:** must
- **Journeys:** J-03, J-05
- **Business acceptance criteria:**
  - Given nieodhaczona pozycja, when domownik ją odhaczy, then pozycja zostaje na liście jako przekreślona i przenosi się pod nieodhaczone.
  - Given odhaczona pozycja, when domownik ją odznaczy, then wraca do nieodhaczonych.
  - Given lista z odhaczonymi pozycjami, when domownik wybierze „usuń odhaczone”, then wszystkie odhaczone pozycje znikają, a nieodhaczone zostają.
- **Business rules:** Wygląd (przekreślenie, kolejność) do ustalenia w designie.

### F-09 Blokada duplikatu
- **Persona:** Domownik (właściciel lub uczestnik)
- **Description:** Przy dodawaniu pozycji lub zmianie jej nazwy aplikacja ostrzega i nie zapisuje zmiany, gdy na liście jest już inna pozycja o tej samej nazwie — nieodhaczona lub odhaczona.
- **Origin:** new
- **Priority:** must
- **Journeys:** J-03
- **Business acceptance criteria:**
  - Given na liście jest pozycja „Mleko”, when domownik dodaje „mleko”, then widzi ostrzeżenie, że taka pozycja już jest na liście, i pozycja nie zostaje dodana.
  - Given na liście jest odhaczona pozycja „Mleko”, when domownik dodaje „mleko”, then widzi ostrzeżenie i pozycja nie zostaje dodana; aby znów kupić mleko, domownik odznacza istniejącą pozycję (F-08).
  - Given na liście są pozycje „Mleko” i „Masło”, when domownik zmienia nazwę „Masło” na „mleko”, then widzi ostrzeżenie i nazwa nie zostaje zmieniona.
  - Given na liście jest pozycja „Mleko”, when domownik zmienia jej nazwę na „mleko” lub tylko jej ilość/notatkę, then zmiana zostaje zapisana (pozycja nie jest duplikatem samej siebie).
  - Given na liście jest „Mleko”, when domownik dodaje „Mleko owsiane”, then ostrzeżenia nie ma.
- **Business rules:** Porównanie dokładnej nazwy bez rozróżniania wielkości liter, wśród wszystkich pozycji listy (nieodhaczonych i odhaczonych). Dotyczy dodawania i zmiany nazwy (F-07). Ostrzeżenia nie da się pominąć — jedyną drogą jest odznaczenie istniejącej pozycji.

### F-10 Kto dodał i kto odhaczył
- **Persona:** Domownik (właściciel lub uczestnik)
- **Description:** Przy pozycji widać, kto ją dodał, a przy odhaczonej — kto ją odhaczył.
- **Origin:** new
- **Priority:** must
- **Journeys:** J-03, J-05
- **Business acceptance criteria:**
  - Given pozycja dodana przez Anię, when inny uczestnik patrzy na listę, then widzi, że pozycję dodała Ania.
  - Given pozycja odhaczona przez Tomka, when ktoś patrzy na listę, then widzi, że odhaczył ją Tomek.
  - Given autor pozycji usunął konto, when ktoś patrzy na listę, then pozycja ma podpis „usunięty użytkownik”.
- **Business rules:** Osoba jest przedstawiana imieniem z konta (F-01, F-16). E-mail nie jest pokazywany przy pozycjach.

### F-11 Link zaproszenia
- **Persona:** Domownik (właściciel)
- **Description:** Właściciel generuje jednorazowy link zaproszenia do listy, ważny 7 dni, i może unieważnić niewykorzystany link.
- **Origin:** new
- **Priority:** must
- **Journeys:** J-04
- **Business acceptance criteria:**
  - Given właściciel listy, when wygeneruje zaproszenie, then dostaje link, który może skopiować i wysłać dowolnym kanałem.
  - Given niewykorzystany link, when właściciel go unieważni, then link przestaje działać.
  - Given link wykorzystany, starszy niż 7 dni lub unieważniony, when ktoś go otworzy, then nie dostaje dostępu do listy i widzi czytelny komunikat (MC-02).
  - Given uczestnik (nie właściciel), when próbuje wygenerować zaproszenie, then nie może tego zrobić.
- **Business rules:** Jeden link to jedno zaproszenie dla jednej osoby. Tylko właściciel zaprasza.

### F-12 Przyjęcie zaproszenia
- **Persona:** Domownik (zaproszony)
- **Description:** Osoba z ważnym linkiem loguje się lub zakłada konto i przyjmuje zaproszenie; lista pojawia się wśród jej list.
- **Origin:** new
- **Priority:** must
- **Journeys:** J-04
- **Business acceptance criteria:**
  - Given zalogowany domownik z ważnym linkiem, when przyjmie zaproszenie, then staje się uczestnikiem i widzi listę.
  - Given osoba bez konta z ważnym linkiem, when zarejestruje się (F-01), then może przyjąć zaproszenie i od razu widzi listę.
  - Given lista ma 20 uczestników, when kolejna osoba próbuje przyjąć zaproszenie, then widzi czytelny komunikat o limicie i nie dołącza.
  - Given właściciel otwiera link do własnej listy lub uczestnik link do listy, na której już jest, when go przyjmuje, then nic się nie zmienia i widzi czytelny komunikat.
- **Business rules:** Limit 20 uczestników na listę.

### F-13 Uczestnicy listy
- **Persona:** Domownik (właściciel, uczestnik)
- **Description:** Właściciel widzi uczestników i usuwa wybranego; uczestnik może sam opuścić listę.
- **Origin:** new
- **Priority:** must
- **Journeys:** J-04
- **Business acceptance criteria:**
  - Given udostępniona lista, when właściciel lub uczestnik otworzy listę uczestników, then widzi imiona właściciela i wszystkich uczestników.
  - Given właściciel otwiera listę uczestników, when patrzy na uczestnika, then widzi także jego e-mail (uczestnik nie widzi e-maili innych osób).
  - Given właściciel usuwa uczestnika, when uczestnik ma otwartą listę, then natychmiast traci dostęp: nie widzi dalszych zmian ani nie może niczego zmienić (MC-03).
  - Given uczestnik opuszcza listę, when to potwierdzi, then lista znika z jego list, a zmiany na niej przestają do niego docierać.
- **Business rules:** Pozycje dodane przez usuniętego lub odchodzącego uczestnika zostają na liście. Właściciel nie może opuścić własnej listy — może ją usunąć (F-05).

### F-14 Zmiany na bieżąco
- **Persona:** Domownik (właściciel lub uczestnik)
- **Description:** Przy otwartej liście zmiany innych osób pojawiają się bez odświeżania.
- **Origin:** new
- **Priority:** must
- **Journeys:** J-05
- **Business acceptance criteria:**
  - Given dwie osoby mają otwartą tę samą listę, when jedna doda, edytuje, odhaczy lub usunie pozycję, then druga widzi zmianę w ciągu maksymalnie 5 sekund bez odświeżania.
  - Given dwie osoby zmieniają tę samą pozycję naraz, when obie zapiszą, then na liście zostaje ostatnia zapisana zmiana.
  - Given jedna osoba usuwa pozycję, a druga ją w tym czasie edytuje, when obie zapiszą, then pozycja pozostaje usunięta.
  - Given właściciel zmienia nazwę lub usuwa listę, when uczestnik ma ją otwartą, then widzi nową nazwę albo informację, że lista została usunięta.
- **Business rules:** Bez scalania zmian i ostrzeżeń o konflikcie. Powiadomienia push poza zakresem.

### F-15 Brak połączenia
- **Persona:** Domownik
- **Description:** Bez połączenia z siecią aplikacja wyraźnie to pokazuje i nie udaje, że zapisała zmianę.
- **Origin:** new
- **Priority:** must
- **Journeys:** J-03, J-05
- **Business acceptance criteria:**
  - Given domownik traci połączenie, when ma otwartą aplikację, then widzi wyraźny komunikat „brak połączenia”.
  - Given brak połączenia, when domownik próbuje dodać, edytować lub odhaczyć pozycję, then aplikacja nie pokazuje zmiany jako zapisanej.
  - Given połączenie wraca, when domownik ma otwartą listę, then widzi jej aktualny stan.
- **Business rules:** Tryb offline z kolejkowaniem zmian poza zakresem.

### F-16 Zmiana imienia
- **Persona:** Domownik
- **Description:** Domownik zmienia imię, pod którym widzą go inni na listach.
- **Origin:** new
- **Priority:** must
- **Journeys:** J-01
- **Business acceptance criteria:**
  - Given zalogowany domownik, when zmieni imię na poprawne (1–30 znaków), then nowe imię jest widoczne przy jego pozycjach i na listach uczestników u wszystkich.
  - Given puste imię lub dłuższe niż 30 znaków, when domownik próbuje je zapisać, then zmiana się nie udaje z czytelnym komunikatem.
- **Business rules:** Imię nie musi być unikalne.

## 8. Wymagania niefunkcjonalne (w kategoriach biznesowych)

| ID | Area | Requirement |
| --- | --- | --- |
| N-01 | Platformy | Wygodne używanie na komputerze (przeglądarka) i na telefonie. Forma techniczna (aplikacja natywna, strona responsywna, PWA) należy do `/tech-architecture`. |
| N-02 | Prywatność / dane | Treść list jest prywatna i widoczna tylko dla właściciela i uczestników. Polityka prywatności i regulamin w aplikacji, akceptowane przy rejestracji. Minimalny wiek 16 lat. Bez zewnętrznej analityki i śledzenia. Usunięcie konta usuwa dane zgodnie z F-04. Bez dodatkowych działań dostosowujących do RODO — aplikacja pilotażowa, decyzja właściciela (zob. R-05). |
| N-03 | Dostępność usługi | „W miarę możliwości”, bez gwarancji czasu działania; przerwa (np. w nocy) akceptowalna, utrata danych nie. Kopia bazy raz dziennie, przechowywana 7 dni. Alarm o awarii mailem do właściciela projektu. |
| N-04 | Dostępność (accessibility) | Cel: WCAG 2.2 AA. Aplikacja poza zakresem Europejskiego Aktu o Dostępności (EAA) — niekomercyjny projekt pilotażowy, według oceny właściciela. |
| N-05 | Języki | Tylko polski interfejs i polskie formaty. Wielojęzyczność poza zakresem. |
| N-06 | Szybkość synchronizacji | Zmiana innej osoby widoczna przy otwartej liście w ciągu maksymalnie 5 sekund (F-14). |

## 8b. Bezpieczeństwo i nadużycia

### Klasyfikacja danych

| Data | Class (public / internal / personal / sensitive) | Why we need it |
| --- | --- | --- |
| Imię | personal | Przedstawienie osoby przy pozycjach i na liście uczestników (F-10, F-13) |
| Adres e-mail | personal | Logowanie, reset hasła; widoczny tylko dla właściciela listy na liście uczestników |
| Hasło (przechowywane w formie nieodczytywalnej) | personal | Logowanie |
| Nazwa listy, pozycje, ilość/notatka | personal (niska wrażliwość; traktowane jako prywatne, bo mogą pośrednio zdradzać np. leki lub dietę) | Główna funkcja |
| Członkostwo w listach, autor dodania/odhaczenia | personal | Udostępnianie (F-11–F-13), F-10 |

### Przypadki nadużyć

| ID | Who | Tries to | Must not succeed because |
| --- | --- | --- | --- |
| MC-01 | Inny zalogowany użytkownik | Odczytać lub zmienić cudzą listę, np. podmieniając identyfikator w adresie | Dostęp do listy i jej pozycji mają wyłącznie właściciel i uczestnicy, sprawdzane przy każdej operacji |
| MC-02 | Osoba, która przechwyciła link zaproszenia | Dołączyć do listy linkiem już wykorzystanym, wygasłym lub unieważnionym | Link jest jednorazowy, ważny 7 dni i unieważnialny; po użyciu nie daje dostępu |
| MC-03 | Usunięty lub odchodzący uczestnik | Dalej widzieć lub zmieniać listę, np. przez wciąż otwarte połączenie „na żywo” | Utrata dostępu działa natychmiast, także dla otwartych połączeń |
| MC-04 | Atakujący z zewnątrz | Przejąć konto przez zgadywanie hasła lub nadużycie resetu hasła | Próby logowania i resetu są ograniczane; link resetu jest jednorazowy i wygasa; komunikaty nie zdradzają, czy konto istnieje |
| MC-05 | Bot / spamer | Masowo zakładać konta lub zalewać usługę danymi | Rejestracja jest ograniczana, a limity (F-05, F-07, F-12) blokują zapychanie danych |

Domena wysokiego ryzyka (płatności, zdrowie, dzieci, kategorie szczególne): nie. Profesjonalny audyt bezpieczeństwa niepotrzebny.

## 9. Model biznesowy

Brak. Aplikacja jest darmowa, bez płatności i reklam, używana przez domowników w ramach pilotażu procesu. Monetyzacja poza zakresem.

## 10. Miary sukcesu

Oceniane po 4 tygodniach używania.

| Metric | Target | How measured |
| --- | --- | --- |
| Domownicy regularnie używający wspólnej listy | ≥ 2 | Liczba aktywnych uczestników tygodniowo, z danych aplikacji |
| Wspólne zakupy z aplikacją zamiast kartki | ≥ 3 w tygodniu | Liczba dni z co najmniej 3 odhaczonymi pozycjami na wspólnej liście, z danych aplikacji (przybliżenie) |
| Zgubione zmiany lub opóźnienia synchronizacji ponad 5 sekund | 0 | Zgłoszenia domowników notowane ręcznie (np. w `docs/pilot-log.md`) |

## 11. Poza zakresem

| Item | Reason | Revisit when |
| --- | --- | --- |
| Tryb offline z kolejką zmian (B1) | Najdroższa część tej klasy aplikacji (kolejka, scalanie, konflikty) | Gdy brak zasięgu w sklepie okaże się realnym problemem |
| Powiadomienia push (B2) | Osobny kanał, ustawienia i koszt; nie są potrzebne do walidacji | Po pilotażu, jeśli domownicy przegapiają zmiany |
| Gospodarstwo domowe — grupa współdzieląca wszystkie listy (B3) | Nowy byt i członkostwo, przeprojektowanie uprawnień | Gdy domownicy prowadzą wiele list |
| Kategorie i kolejność działów sklepu (B4) | Różne układy sklepów, ryzyko przekombinowania | Po pilotażu |
| Podpowiedzi z historii pozycji (A3) | Niekonieczne do walidacji; limit 5–8 tasków w pilotażu | Kolejny epik |
| Udostępnianie bez konta (C1) | Trwały anonimowy dostęp do prywatnej listy, brak kontroli uczestników | Nie planujemy |
| Ceny i promocje ze sklepów (C2) | Scraping lub integracje, ryzyka prawne, koszt L bez wpływu na problem | Nie planujemy |
| Funkcje AI: lista z przepisu, zdjęcia, głosu (C3) | Koszt API, niedeterministyczne wyniki, odciąga od celu pilotażu | Nie planujemy |
| Czat przy liście (C4) | Dubluje istniejące komunikatory, moderacja i przechowywanie wiadomości | Nie planujemy |
| Zaproszenia wysyłane mailem | Wymaga wysyłki maili i istniejącego konta; zastąpione linkiem | Gdyby link okazał się niewygodny |
| Logowanie przez Google itp. | Nie jest potrzebne do walidacji | Po pilotażu |
| Eksport danych | Mała wartość dla użytku domowego | Na prośbę użytkownika |
| Ceny, kategorie, zdjęcia pozycji | Minimum zastępujące kartkę to nazwa i ilość/notatka | Po pilotażu |
| Monetyzacja, płatności, reklamy | Projekt niekomercyjny | Nie planujemy |
| Wielojęzyczność | Użytkownicy mówią po polsku | Gdy pojawią się użytkownicy obcojęzyczni |
| Zewnętrzna analityka | Przesada przy kilku osobach; temat w polityce prywatności | Nie planujemy |
| Role administracyjne, panel wsparcia, moderacja | Listy są prywatne, brak publicznych treści | Nie planujemy |

## 12. Założenia i ryzyka

| ID | Assumption / risk | Impact if wrong | How to test |
| --- | --- | --- | --- |
| R-01 | Domownicy naprawdę będą używać aplikacji zamiast kartki (najbardziej ryzykowne założenie) | Pilotaż nie przetestuje uczciwie procesu; brak prawdziwego użycia | Przez tydzień używać z domownikami Listonica lub Bring! i notować, co przeszkadza i czego brakuje |
| R-02 | Zasięg w sklepie wystarcza do pracy online | Odhaczenia nie zapisują się w sklepie, spada zaufanie | Sprawdzić zasięg w sklepach, w których robicie zakupy; obserwować zgłoszenia w pilotażu |
| R-03 | Wymóg konta nie zniechęci domowników | Zaproszeni nie dołączają, współdzielenie nie działa | Obserwować, czy zaproszeni kończą rejestrację |
| R-04 | Zasada „wygrywa ostatnia zmiana” wystarcza | Domownicy tracą zmiany przy równoczesnej edycji | Zgłoszenia domowników w pilotażu (miara sukcesu) |
| R-05 | Pilotaż bez działań dostosowujących do RODO jest akceptowalny | Otwarta rejestracja pozwala zapisać się osobom spoza domu; wtedy wyłączenie „do celów czysto osobistych” może nie obejmować aplikacji | Przed udostępnieniem komuś spoza domowników wrócić do tematu (np. zamknąć rejestrację lub skonsultować z prawnikiem) |

## 13. Otwarte pytania

Brak — wszystkie rozstrzygnięte przy zatwierdzeniu (2026-10-26).

## 14. Słownik

| Term | Meaning |
| --- | --- |
| Domownik | Użytkownik aplikacji; osoba współdzieląca zakupy z innymi |
| Lista | Lista zakupów z pozycjami; ma jednego właściciela |
| Pozycja | Element listy: nazwa, opcjonalna ilość/notatka, stan odhaczenia |
| Właściciel | Twórca listy; jedyny, kto zmienia nazwę, usuwa listę, zaprasza i usuwa uczestników |
| Uczestnik | Osoba, która przyjęła zaproszenie; zarządza pozycjami, może opuścić listę |
| Link zaproszenia | Jednorazowy link ważny 7 dni, dający jednej osobie dostęp do listy |
| Odhaczenie | Oznaczenie pozycji jako kupionej |

## 15. Historia zmian

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-26 | 0.1 | Pierwsza wersja robocza po wywiadzie (fazy 1–4b). |
| 2026-10-26 | 1.0 | Rozstrzygnięte otwarte pytania (EAA, RODO, duplikat, 5 s); BRD zatwierdzone. |
| 2026-10-26 | 1.1 | F-09: blokada duplikatu obejmuje też zmianę nazwy pozycji (na prośbę właściciela). |
| 2026-10-26 | 1.2 | Luki z /brd-to-design: imię przy rejestracji i F-16 zmiana imienia; prezentacja osoby imieniem (F-10, F-13); hasło ≥8 znaków (F-01, F-03); link resetu ważny 1 h (F-03). |
| 2026-10-26 | 1.3 | F-05: nazwa listy 1–100 znaków (luka z /brd-to-design). |
