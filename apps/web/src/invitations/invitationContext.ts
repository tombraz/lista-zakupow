/**
 * Kontekst zaproszenia przekazywany SC-08 → SC-01 / SC-02 w stanie nawigacji (nie w
 * `localStorage`, nie w adresie): token i nazwa listy do komunikatu „Info — zaproszenie”.
 */
export interface InvitationContext {
  token: string;
  listName: string;
}

/**
 * Stan nawigacji ekranów wejściowych: kontekst zaproszenia, wpisany już e-mail (3.3.7)
 * i lista, do której rejestracja już dołączyła (`joinedListId`).
 */
export interface EntryState {
  invitation?: InvitationContext;
  email?: string;
  joinedListId?: string;
}

/**
 * Dokąd po zalogowaniu lub rejestracji z kontekstem zaproszenia: na listę, gdy rejestracja
 * już dołączyła, inaczej na SC-08, który dołączy od razu. `null` — bez zaproszenia.
 */
export function afterEntry(state: unknown): { to: string; state: object } | null {
  const invitation = invitationOf(state);
  if (!invitation) return null;
  const listId = isRecord(state) ? state["joinedListId"] : undefined;
  if (typeof listId === "string") {
    const joined: JoinedState = { joined: invitation.listName };
    return { to: `/listy/${encodeURIComponent(listId)}`, state: joined };
  }
  const join: InvitationScreenState = { join: true };
  return { to: invitationPath(invitation.token), state: join };
}

/** Stan nawigacji na SC-08: `join` — dołącz od razu (powrót po logowaniu lub rejestracji). */
export interface InvitationScreenState {
  join?: boolean;
}

/** Stan nawigacji na SC-06 po dołączeniu: nazwa listy do komunikatu „Dołączyłeś(-aś)…”. */
export interface JoinedState {
  joined?: string;
}

export const invitationPath = (token: string) => `/zaproszenie/${encodeURIComponent(token)}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Kontekst zaproszenia ze stanu nawigacji albo `null`. */
export function invitationOf(state: unknown): InvitationContext | null {
  const invitation = isRecord(state) ? state["invitation"] : undefined;
  if (!isRecord(invitation)) return null;
  const { token, listName } = invitation;
  return typeof token === "string" && typeof listName === "string" ? { token, listName } : null;
}

/** E-mail wpisany na poprzednim ekranie wejściowym albo pusty. */
export function emailOf(state: unknown): string {
  const email = isRecord(state) ? state["email"] : undefined;
  return typeof email === "string" ? email : "";
}

export function shouldJoin(state: unknown): boolean {
  return isRecord(state) && state["join"] === true;
}

export function joinedListOf(state: unknown): string | null {
  const joined = isRecord(state) ? state["joined"] : undefined;
  return typeof joined === "string" ? joined : null;
}
