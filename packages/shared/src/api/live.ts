import { z } from "zod";
import type { Item } from "./items";

// Identyfikator listy z wiadomości klienta: niepoprawny daje `not_found` jak w HTTP, więc schemat
// ogranicza tylko długość (TH-25), a nie format.
const listId = z.string().min(1).max(100);

const clientMessageSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("subscribe"), listId }),
  z.strictObject({ type: z.literal("unsubscribe"), listId }),
  z.strictObject({ type: z.literal("pong") }),
]);

/** Wiadomość klient → serwer (api.md, „Zmiany na żywo”). */
export type LiveClientMessage = z.infer<typeof clientMessageSchema>;

/** Zdarzenie kanału listy `list:<id>` (api.md, „Zmiany na żywo”). */
export type ListEvent =
  | { type: "item.upserted"; listId: string; item: Item }
  | { type: "item.deleted"; listId: string; itemId: string }
  | { type: "items.cleared"; listId: string; itemIds: string[] }
  | { type: "list.updated"; listId: string; name: string }
  | { type: "list.deleted"; listId: string }
  | { type: "members.changed"; listId: string };

/** Zdarzenie kanału domownika `user:<id>`. */
export type UserEvent =
  /** Tylko do właściciela: link użyty lub unieważniony (SC-07). */
  | { type: "invitations.changed"; listId: string }
  /** Odśwież SC-05. */
  | { type: "lists.changed" };

/** Wiadomość serwer → klient. */
export type LiveServerMessage =
  | ListEvent
  | UserEvent
  | { type: "subscribed"; listId: string }
  | { type: "access.revoked"; listId: string }
  /** `not_found` — brak dostępu (MC-01); `validation_failed` — wiadomość niezgodna ze schematem. */
  | { type: "error"; code: "not_found"; listId: string }
  | { type: "error"; code: "validation_failed" }
  | { type: "ping" };

/** Wiadomość klienta albo `null`, gdy to nie JSON lub nie pasuje do schematu (TH-25). */
export function parseClientMessage(text: string): LiveClientMessage | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const result = clientMessageSchema.safeParse(json);
  return result.success ? result.data : null;
}
