# Decyzje produktowe

| Data | Decyzja |
| --- | --- |
| 2026-10-26 | Koncepcja potwierdzona: wspólna lista zakupów dla domowników; konta, listy, dodawanie i odhaczanie pozycji, udostępnianie z podglądem zmian na bieżąco. |
| 2026-10-26 | Lista może być udostępniona kilku osobom (nie tylko jednej). |
| 2026-10-26 | Web i mobile to wymóg biznesowy (wygodny dostęp z komputera i telefonu); forma techniczna należy do /tech-architecture. |
| 2026-10-26 | Pilotaż: pierwsza wersja to tylko MVP jako jeden epik; reszta poza zakresem. |
| 2026-10-26 | Po ocenie (faza 2): kontynuujemy jako pilotaż; celem jest test procesu, nie produkt komercyjny. |
| 2026-10-26 | Jedna persona: domownik; brak ról administracyjnych w aplikacji. Brak modelu biznesowego (darmowa, bez płatności i reklam); monetyzacja poza zakresem. |
| 2026-10-26 | Obecne obejście: kartka papieru. |
| 2026-10-26 | Udostępnia się pojedynczą listę konkretnym osobom; pozostałe listy właściciela są prywatne. Model „gospodarstwa domowego” odłożony. |
| 2026-10-26 | Pozycja: nazwa (wymagana) + jedno opcjonalne pole tekstowe na ilość/notatkę + stan odhaczenia. Kategorie, ceny, zdjęcia, sortowanie wg alejek poza zakresem. |
| 2026-10-26 | Odhaczona pozycja zostaje na liście (przekreślona, na dole), można ją odznaczyć; akcja „usuń odhaczone” czyści listę. |
| 2026-10-26 | Zaproszenie: jednorazowy link ważny 7 dni, wysyłany dowolnym kanałem; odbiorca loguje się lub zakłada konto i przyjmuje zaproszenie; właściciel może unieważnić niewykorzystany link. Zaproszenia mailowe odrzucone na MVP. |
| 2026-10-26 | Prawa: właściciel zmienia nazwę, usuwa listę, zaprasza i usuwa uczestników; uczestnik dodaje/edytuje/odhacza/usuwa pozycje i może opuścić listę, nie zaprasza innych. |
| 2026-10-26 | „Na bieżąco”: przy otwartej aplikacji zmiana innej osoby widoczna w ciągu kilku sekund bez odświeżania. Powiadomienia push poza MVP. |
| 2026-10-26 | MVP wymaga połączenia; bez sieci wyraźny komunikat „brak połączenia”, bez udawania zapisu. Tryb offline odłożony na później. |
| 2026-10-26 | Konflikty: wygrywa ostatnia zapisana zmiana; usunięcie wygrywa z równoczesną edycją. Bez scalania i ostrzeżeń. |
| 2026-10-26 | Ścieżki MVP: (1) rejestracja i logowanie web+telefon, (2) listy: tworzenie, zmiana nazwy, usuwanie, przegląd własnych i udostępnionych, (3) pozycje: dodawanie, edycja, usuwanie, odhaczanie/odznaczanie, usuń odhaczone, (4) udostępnianie: link, przyjęcie, lista uczestników, usunięcie uczestnika, opuszczenie listy, (5) wspólne zakupy ze zmianami na bieżąco. |
| 2026-10-26 | Limity: 50 list/konto, 500 pozycji/listę, 20 uczestników/listę, nazwa pozycji ≤100 znaków, ilość/notatka ≤200 znaków; czytelny komunikat po przekroczeniu. |
| 2026-10-26 | Język: tylko polski interfejs w MVP; wielojęzyczność poza zakresem. |
| 2026-10-26 | Miary sukcesu po 4 tygodniach: ≥2 domowników regularnie używa wspólnej listy; ≥3 wspólne zakupy/tydzień z aplikacją zamiast kartki; 0 zgłoszonych przypadków zgubionej zmiany lub opóźnienia > kilka sekund. |
| 2026-10-26 | Faza 4 — do MVP: A1 ostrzeżenie o duplikacie (dokładna nazwa, bez wielkości liter), A2 informacja kto dodał i kto odhaczył pozycję. |
| 2026-10-26 | Faza 4 — odłożone: A3 podpowiedzi z historii (niekonieczne do walidacji, limit 5–8 tasków), B1 tryb offline, B2 powiadomienia push, B3 gospodarstwo domowe, B4 kategorie i kolejność działów. |
| 2026-10-26 | Faza 4 — odrzucone: C1 udostępnianie bez konta (trwały anonimowy dostęp, brak testu uprawnień), C2 ceny i promocje sklepów (koszt L, ryzyka prawne, bez wpływu na problem), C3 funkcje AI (koszt, niedeterminizm, odciąga od celu pilotażu), C4 czat przy liście (dubluje komunikatory, moderacja). |
| 2026-10-26 | Logowanie: e-mail + hasło; reset hasła linkiem wysłanym mailem (jedyny mail wysyłany przez aplikację). Logowanie przez Google itp. odłożone. |
| 2026-10-26 | Usunięcie konta w MVP: listy właściciela usuwane razem z kontem (uczestnicy tracą dostęp); z cudzych list użytkownik wypisany, jego pozycje zostają z podpisem „usunięty użytkownik”. Eksport danych poza zakresem. |
| 2026-10-26 | Otwarta rejestracja; krótka polityka prywatności i regulamin akceptowane przy rejestracji; minimalny wiek 16 lat. |
| 2026-10-26 | Pusty stan: jedno zdanie + przycisk „Utwórz pierwszą listę”; wejście z linku zaproszenia prowadzi po rejestracji prosto do udostępnionej listy; bez samouczka. |
| 2026-10-26 | Dane: e-mail, hasło (nieodczytywalne), treść list — dane osobowe niskiej wrażliwości, treść list traktowana jako prywatna. Domena nie jest wysokiego ryzyka. Przypadki nadużyć MC-01…MC-05 potwierdzone (dostęp do cudzej listy, przechwycony/ponowny link, usunięty uczestnik z dostępem, przejęcie konta, masowe konta/spam). |
| 2026-10-26 | Dostępność: cel WCAG 2.2 AA. Status EAA nie wybrany wprost — zapisany jako otwarte pytanie (prawnik albo ocena właściciela). |
| 2026-10-26 | Pomiar bez narzędzi analitycznych i śledzenia: liczby z danych aplikacji (aktywne wspólne listy, dni z ≥3 odhaczeniami, aktywni uczestnicy tygodniowo); zgubione zmiany i opóźnienia zgłaszane przez domowników i notowane ręcznie. |
| 2026-10-26 | Operacje: alarmy o awarii mailem do właściciela; kopia bazy raz dziennie, przechowywana 7 dni; dostępność „w miarę możliwości”, bez gwarancji — przerwa akceptowalna, utrata danych nie. |
| 2026-10-26 | EAA: aplikacja poza zakresem EAA — niekomercyjny projekt pilotażowy, ocena właściciela. |
| 2026-10-26 | RODO: bez dodatkowych działań dostosowujących do RODO — aplikacja pilotażowa (ryzyko zapisane jako R-05). |
| 2026-10-26 | Duplikat (F-09): dotyczy też pozycji odhaczonych; pozycji nie da się dodać mimo ostrzeżenia — można jedynie odznaczyć istniejącą pozycję. |
| 2026-10-26 | „Na bieżąco” = maksymalnie 5 sekund (F-14, N-06, miara sukcesu). |
| 2026-10-26 | BRD v1.0 zatwierdzone przez właściciela. |
| 2026-10-26 | F-09: zmiana nazwy pozycji na nazwę innej pozycji z listy (także odhaczonej) jest blokowana tak jak dodanie duplikatu. |
| 2026-10-26 | Imię (1–30 znaków, wymagane, nieunikalne) przy rejestracji, zmienialne na ekranie Konto (F-16); osoba przedstawiana imieniem; e-mail uczestników widzi tylko właściciel. |
| 2026-10-26 | Hasło: co najmniej 8 znaków, bez wymogu cyfr i znaków specjalnych. |
| 2026-10-26 | Link resetu hasła ważny 1 godzinę. |
| 2026-10-26 | Nazwa listy: 1–100 znaków (F-05). |
| 2026-10-26 | Dostarczanie MVP w czterech epikach (zakres wydania bez zmian): E-01 szkielet i pierwsza wspólna lista (epik pilotażu), E-02 konto i zarządzanie udostępnianiem, E-03 produkcja i operacje, E-04 aplikacja mobilna. Powód: pełne MVP to ~24 taski mieszczące się w jednej sesji agenta, a pilotaż zakłada epik 5–8 tasków (`/plan-backlog`). |
