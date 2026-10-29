import {
  BUSINESS_LIMITS,
  createItemRequestSchema,
  fieldErrors,
  type FieldErrorCode,
  type Item,
} from "@lista/shared";
// eslint-disable-next-line no-restricted-imports -- T-020: idempotentne `id` (T-006); wpisanie i Enter w trakcie zapisu wysyła nową treść.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { asRequestError, type RequestErrorCode } from "../../api/client";
import { addItem } from "../../api/items";
import { upsertNewer } from "./itemsCache";
import { sameNameAs } from "./sameName";
import { messages } from "./messages";

type Fields = Partial<Record<"name" | "note", FieldErrorCode>>;

/**
 * Ostrzeżenie nad polami AddBar: duplikat (F-09) albo limit 500 pozycji (F-07). Limit z API
 * pamięta liczbę pozycji, przy której przyszedł: obowiązuje, dopóki ich nie ubędzie.
 */
export type AddWarning =
  /** `bought`: pozycja z listy, gdy jest odhaczona — jedyną drogą jest jej odznaczenie (F-09). */
  { kind: "duplicate"; name: string; bought: Item | null } | { kind: "limit"; atCount: number };

/** dup.bought wygasa, gdy tej pozycji już nie ma wśród kupionych (odznaczona, usunięta). */
function stillValid(warning: AddWarning | null, items: Item[]): AddWarning | null {
  if (warning?.kind !== "duplicate" || warning.bought === null) return warning;
  const { id } = warning.bought;
  return items.some((item) => item.id === id && item.checked) ? warning : null;
}

function duplicateOf(items: Item[], typed: string): AddWarning {
  const existing = sameNameAs(items, typed);
  return {
    kind: "duplicate",
    name: existing?.name ?? typed,
    bought: existing?.checked ? existing : null,
  };
}

/**
 * AddBar (SC-06, F-07, F-09): walidacja i sprawdzenie duplikatu tymi samymi regułami co API,
 * pozycja na liście dopiero po odpowiedzi API (F-15). Jedno `id` na wysłaną treść, więc
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
  const limitReached =
    items.length >= BUSINESS_LIMITS.itemsPerList ||
    (warning?.kind === "limit" && items.length >= warning.atCount);

  const added = (item: Item, sent: Draft) => {
    upsertNewer(client, listId, item);
    draft.clear(sent);
    setAnnouncement(messages.add.added(item.name));
  };

  const failed = (error: unknown, typed: string) => {
    const { code, fields: invalid } = asRequestError(error);
    if (code === "duplicate_item") setWarning(duplicateOf(items, typed));
    else if (code === "limit_reached") setWarning({ kind: "limit", atCount: items.length });
    else if (code === "validation_failed") setFields(invalid);
    else setFailure(code);
  };

  const submit = () => {
    setWarning(null);
    setFailure(null);
    const sent: Draft = { name: draft.name, note: draft.note };
    const parsed = createItemRequestSchema.safeParse(sent);
    setFields(parsed.success ? {} : fieldErrors(parsed.error));
    if (!parsed.success) return;
    if (sameNameAs(items, parsed.data.name)) {
      setWarning(duplicateOf(items, parsed.data.name));
      return;
    }
    mutation.mutate(
      { id: draft.idFor(sent), ...parsed.data },
      {
        onSuccess: (item) => {
          added(item, sent);
        },
        onError: (error) => {
          failed(error, parsed.data.name);
        },
      },
    );
  };

  return {
    ...draft,
    fields,
    warning: stillValid(warning, items),
    failure,
    limitReached,
    announcement,
    pending: mutation.isPending,
    submit,
  };
}

export type AddItemState = ReturnType<typeof useAddItem>;

interface Draft {
  name: string;
  note: string;
}

const EMPTY_DRAFT: Draft = { name: "", note: "" };

const sameDraft = (a: Draft, b: Draft) => a.name === b.name && a.note === b.note;

/**
 * Wpisywana pozycja: pola i `id` ostatnio wysłanej treści. Ponowienie tej samej treści używa
 * tego samego `id` (AC6), zmieniona treść albo dodanie dostaje nowe; fokus zostaje w polu nazwy.
 */
function useItemDraft() {
  const nameRef = useRef<HTMLInputElement>(null);
  const attempt = useRef<{ id: string; sent: Draft } | null>(null);
  const [fields, setFields] = useState<Draft>(EMPTY_DRAFT);
  const idFor = (sent: Draft) => {
    const last = attempt.current;
    const id = last && sameDraft(last.sent, sent) ? last.id : crypto.randomUUID();
    attempt.current = { id, sent };
    return id;
  };
  /** Po dodaniu `sent` czyści pola, chyba że w trakcie zapisu wpisano już coś nowego (F-15). */
  const clear = (sent: Draft) => {
    attempt.current = null;
    setFields((current) => (sameDraft(current, sent) ? EMPTY_DRAFT : current));
    nameRef.current?.focus();
  };
  const setName = (name: string) => {
    setFields((current) => ({ ...current, name }));
  };
  const setNote = (note: string) => {
    setFields((current) => ({ ...current, note }));
  };
  return { nameRef, ...fields, setName, setNote, idFor, clear };
}
