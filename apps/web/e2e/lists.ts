import type { Page } from "@playwright/test";
import { expect, newAccount, signUp } from "./fixtures";

export const NAME = "Co kupić?";
export const NOTE = "Ilość / notatka (opcjonalnie)";

/** Żądanie API w sesji strony (ten sam origin i ciasteczko co przeglądarka). */
export function api(page: Page) {
  const headers = { origin: new URL(page.url()).origin };
  return {
    post: (url: string, data: object) => page.request.post(url, { data, headers }),
    delete: (url: string) => page.request.delete(url, { headers }),
  };
}

/** Nowe konto Ani z nową listą otwartą na SC-06. */
export async function openNewList(page: Page, name: string) {
  await signUp(page, newAccount());
  await expect(page.getByRole("heading", { level: 1, name: "Moje listy" })).toBeVisible();
  const response = await api(page).post("/api/v1/lists", { name });
  const list = (await response.json()) as { id: string };
  await page.goto(`/listy/${list.id}`);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return list;
}

// Nie więcej żądań naraz niż połączeń w puli API (10): zapisy i tak czekają na blokadę listy,
// a nadmiar czeka na połączenie dłużej niż 3 s i dostaje 500 (T-031).
const PARALLEL_ADDS = 10;

/**
 * `count` pozycji przez API, potem przeładowanie i czekanie, aż ekran pokaże wszystkie.
 * Każde żądanie musi dać 201: błąd przygotowania danych nie może udawać błędu ekranu (T-031).
 */
export async function addViaApi(page: Page, listId: string, count: number) {
  const url = `/api/v1/lists/${listId}/items`;
  for (let start = 0; start < count; start += PARALLEL_ADDS) {
    const responses = await Promise.all(
      Array.from({ length: Math.min(PARALLEL_ADDS, count - start) }, (_, index) =>
        api(page).post(url, { name: `Pozycja ${String(start + index)}` }),
      ),
    );
    expect(responses.map((response) => response.status())).toEqual(responses.map(() => 201));
  }
  await page.reload();
  await expect(page.getByText(`${String(count)} do kupienia`)).toBeVisible();
}

/** Dodanie pozycji z AddBar (Enter). */
export async function add(page: Page, name: string, note?: string) {
  await page.getByLabel(NAME).fill(name);
  if (note !== undefined) await page.getByLabel(NOTE).fill(note);
  await page.keyboard.press("Enter");
}
