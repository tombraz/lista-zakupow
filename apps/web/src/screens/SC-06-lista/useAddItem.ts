import {
  BUSINESS_LIMITS,
  createItemRequestSchema,
  fieldErrors,
  type FieldErrorCode,
  type Item,
} from "@lista/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { asRequestError, type RequestErrorCode } from "../../api/client";
import { addItem } from "../../api/items";
import { updateItems } from "./itemsCache";
import { sameNameAs } from "./sameName";
import { messages } from "./messages";

type Fields = Partial<Record<"name" | "note", FieldErrorCode>>;

/** Ostrzeżenie nad polami AddBar: duplikat (F-09) albo limit 500 pozycji (F-07). */
export type AddWarning = { kind: "duplicate"; name: string } | { kind: "limit" };

/**
 * AddBar (SC-06, F-07, F-09): walidacja i sprawdzenie duplikatu tymi samymi regułami co API,
 * pozycja na liście dopiero po odpowiedzi API (F-15). Jedno `id` na wpisywaną pozycję, więc
 * ponowione wysłanie po zerwanym połączeniu nie doda jej drugi raz (AC6).
 */
export function useAddItem(listId: string, items: Item[] = []) {
  const client = useQueryClient();
  const draft = useItemDraft();
  const [fields, setFields] = useState<Fields>({});
  const [warning, setWarning] = useState<AddWarning | null>(null);
  const [failure, setFailure] = useState<RequestErrorCode | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const mutation = useMutation({ mutationFn: addItem.bind(null, listId) });
  const limitReached = items.length >= BUSINESS_LIMITS.itemsPerList || warning?.kind === "limit";

  const added = (item: Item) => {
    updateItems(client, listId, (current) => [item, ...current.filter(({ id }) => id !== item.id)]);
    draft.reset();
    setAnnouncement(messages.add.added(item.name));
  };

  const failed = (error: unknown, typed: string) => {
    const { code, fields: invalid } = asRequestError(error);
    if (code === "duplicate_item") setWarning({ kind: "duplicate", name: typed });
    else if (code === "limit_reached") setWarning({ kind: "limit" });
    else if (code === "validation_failed") setFields(invalid);
    else setFailure(code);
  };

  const submit = () => {
    setWarning(null);
    setFailure(null);
    const parsed = createItemRequestSchema.safeParse({ name: draft.name, note: draft.note });
    setFields(parsed.success ? {} : fieldErrors(parsed.error));
    if (!parsed.success) return;
    const existing = sameNameAs(items, parsed.data.name);
    if (existing) {
      setWarning({ kind: "duplicate", name: existing.name });
      return;
    }
    mutation.mutate(
      { id: draft.id, ...parsed.data },
      {
        onSuccess: added,
        onError: (error) => {
          failed(error, parsed.data.name);
        },
      },
    );
  };

  return {
    ...draft,
    fields,
    warning,
    failure,
    limitReached,
    announcement,
    pending: mutation.isPending,
    submit,
  };
}

export type AddItemState = ReturnType<typeof useAddItem>;

/** Wpisywana pozycja: pola i jej `id`, nowe po każdym dodaniu; fokus zostaje w polu nazwy. */
function useItemDraft() {
  const nameRef = useRef<HTMLInputElement>(null);
  const [id, setId] = useState(() => crypto.randomUUID());
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const reset = () => {
    setId(crypto.randomUUID());
    setName("");
    setNote("");
    nameRef.current?.focus();
  };
  return { nameRef, id, name, setName, note, setNote, reset };
}
