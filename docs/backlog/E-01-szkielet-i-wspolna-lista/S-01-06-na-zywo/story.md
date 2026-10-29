---
id: S-01-06
epic: E-01
title: Wspólne zakupy na żywo (web)
status: in-progress    # todo | in-progress | done
requirements: [F-14, N-06]
screens: [SC-05, SC-06, SC-07]
---

# S-01-06 Wspólne zakupy na żywo (web)

**As** domownik robiący zakupy razem z innymi, **I want** widzieć zmiany innych osób na otwartej liście bez odświeżania, **so that** nie kupujemy podwójnie i nie zapominamy o tym, co ktoś dopisał.

## Acceptance criteria (business)

- [ ] Given dwie osoby mają otwartą tę samą listę, when jedna doda, edytuje, odhaczy lub usunie pozycję, then druga widzi zmianę w ≤ 5 s bez odświeżania.
- [ ] Given dwie osoby zmieniają tę samą pozycję naraz, when obie zapiszą, then zostaje ostatnia zapisana zmiana.
- [ ] Given jedna osoba usuwa pozycję, a druga ją edytuje, when obie zapiszą, then pozycja pozostaje usunięta, a druga osoba widzi komunikat.
- [ ] Given właściciel zmienia nazwę lub usuwa listę, when uczestnik ma ją otwartą, then widzi nową nazwę albo informację, że lista została usunięta.
- [ ] Given domownik bez dostępu, when próbuje słuchać zmian cudzej listy, then nic nie dostaje (MC-01).

## Tasks

- T-009 Zmiany na żywo przez WebSocket (web)

## Notes

- Mechanizm: `architecture.md`, „Zmiany na żywo”; zdarzenia: `api.md`, „Zmiany na żywo”.
- Pasek „brak połączenia” i blokada zapisów bez sieci (F-15) — E-02 (S-02-04). Utrata dostępu przez usunięcie uczestnika (MC-03) — E-02 (S-02-02); w E-01 obsługiwane usunięcie listy.
