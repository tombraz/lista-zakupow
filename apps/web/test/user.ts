import type { UserEvent } from "@testing-library/user-event";

/**
 * Wypełnia pole jednym wklejeniem: jedno przerysowanie formularza zamiast jednego na znak.
 * Do pól, w których test nie sprawdza samego pisania (imię, e-mail, hasło): `user.type` po
 * kilkadziesiąt znaków kosztował sekundy na test i pod obciążeniem przekraczał limit (T-021).
 */
export async function fillIn(user: UserEvent, field: HTMLElement, text: string): Promise<void> {
  await user.click(field);
  await user.paste(text);
}
