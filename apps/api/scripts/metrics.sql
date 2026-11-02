-- Miary sukcesu z BRD §10 (T-065), liczone tydzień po tygodniu z `list_daily_activity`.
-- Uruchamiane ręcznie: psql "$DATABASE_URL" -f apps/api/scripts/metrics.sql
-- Plik tylko czyta (same SELECT, bez metakomend psql); wynik zawiera tylko tydzień i liczby.
--
-- Definicje:
-- * Tydzień: poniedziałek–niedziela; kolumna `tydzień` to data poniedziałku. `day` jest już
--   datą w strefie Europe/Warsaw (zapis w module `statystyki`), więc `date_trunc('week', day)`
--   daje tydzień polski, a przełom roku nie dzieli tygodnia (tydzień ISO).
-- * Wspólna lista: lista, która DZIŚ ma co najmniej jeden wiersz `list_member` (właściciel nie
--   jest wierszem `list_member`). Historii członkostw nie ma, więc lista, z której wszyscy
--   uczestnicy wyszli, przestaje się liczyć także wstecz; lista, do której ktoś dołączył,
--   liczy się także za tygodnie sprzed dołączenia.
-- * Aktywny domownik: użytkownik (właściciel albo uczestnik) z co najmniej jednym odhaczeniem
--   na wspólnej liście w danym tygodniu. Aktywność rejestruje tylko odhaczenie (`recordCheck`).
-- * Usunięte konto: jego aktywność znika kaskadowo, więc miary za przeszłe tygodnie mogą
--   spaść. Aktywność starsza niż 90 dni jest usuwana przez sprzątanie (T-064) — miary
--   obejmują najwyżej ostatnie ~13 tygodni; uruchom po 4 tygodniach pilotażu.

-- Miara 1: aktywni domownicy na wspólnych listach, tygodniowo (cel ≥ 2).
SELECT date_trunc('week', a.day)::date AS "tydzień",
       count(DISTINCT a.user_id)::int AS aktywni_domownicy
FROM list_daily_activity a
WHERE EXISTS (SELECT 1 FROM list_member m WHERE m.list_id = a.list_id)
GROUP BY 1
ORDER BY 1;

-- Miara 2: dni wspólnych zakupów, tygodniowo (cel ≥ 3) — dni, w których na którejś wspólnej
-- liście suma odhaczeń wszystkich osób wynosi co najmniej 3. Dwie listy z ≥ 3 tego samego dnia
-- to nadal jeden dzień; odhaczeń z różnych list się nie sumuje. Tydzień z aktywnością na
-- wspólnej liście, ale bez takiego dnia, ma 0.
SELECT "tydzień",
       count(DISTINCT day) FILTER (WHERE checks >= 3)::int AS "dni_wspólnych_zakupów"
FROM (
  SELECT date_trunc('week', a.day)::date AS "tydzień", a.day, sum(a.checks) AS checks
  FROM list_daily_activity a
  WHERE EXISTS (SELECT 1 FROM list_member m WHERE m.list_id = a.list_id)
  GROUP BY a.list_id, a.day
) per_list_day
GROUP BY "tydzień"
ORDER BY "tydzień";
