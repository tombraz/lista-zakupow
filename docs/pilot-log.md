# Dziennik pilotażu

Jedna linia na każdą sytuację, w której agent zrobił coś inaczej, niż się spodziewałeś.

Typ: `instrukcja` (skill mówi niejasno albo czegoś brakuje) · `posłuszeństwo` (skill mówi jasno, agent zrobił inaczej) · `koszt` (za wolno, za drogo, za dużo pytań) · `proces` (krok niepotrzebny albo brakujący)

Waga: `wysoka` (zła jakość mogła przejść dalej) · `średnia` (strata czasu) · `niska` (kosmetyka)

| Data | Skill / krok | Co się stało | Oczekiwane | Typ | Waga |
| --- | --- | --- | --- | --- | --- |
| 2026-10-26 | /tech-architecture (threat-model) | Model zagrożeń przetłumaczony na polski razem z etykietami `## Threats` i `Covered by`; `backlog-check` nie znalazł żadnego zagrożenia (40 błędów „not found”) | Etykiety czytane przez skrypty zostają po angielsku; skill mówi to wprost | instrukcja | wysoka |
| 2026-10-26 | /plan-backlog (epiki) | Pełne MVP (16 F-xx, web + mobile, infra) to ~24 taski na jedną sesję; PILOT.md i BRD zakładały jeden epik 5–8 tasków. Podzielone na 4 epiki, E-01 ma 10 tasków | PILOT.md / /concept-to-brd ograniczają zakres MVP do rozmiaru jednego epiku pilotażu | proces | średnia |


## Pomiary

| Miara | Wynik |
| --- | --- |
| Czas: /concept-to-brd | |
| Czas: /brd-to-design | |
| Czas: /tech-architecture | |
| Czas: /ci-cd | |
| Czas: /plan-backlog | |
| Ile razy /build-epic zatrzymał się z pytaniem | |
| Rundy QA na task (średnio / maks.) | |
