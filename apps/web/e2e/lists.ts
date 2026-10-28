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

/** Dodanie pozycji z AddBar (Enter). */
export async function add(page: Page, name: string, note?: string) {
  await page.getByLabel(NAME).fill(name);
  if (note !== undefined) await page.getByLabel(NOTE).fill(note);
  await page.keyboard.press("Enter");
}
