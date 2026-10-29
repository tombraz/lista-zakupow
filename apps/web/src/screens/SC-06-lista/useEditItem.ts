import {
  fieldErrors,
  updateItemRequestSchema,
  type FieldErrorCode,
  type Item,
  type UpdateItemRequest,
} from "@lista/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { asRequestError, type RequestErrorCode } from "../../api/client";
import { deleteItem, updateItem } from "../../api/items";
import { replaceItem, updateItems } from "./itemsCache";
import { sameNameAs } from "./sameName";
import { useGuardedMutation } from "../../api/useGuardedMutation";

type Fields = Partial<Record<"name" | "note", FieldErrorCode>>;

/** Tylko zmienione pola: zapis nie nadpisuje cudzej zmiany drugiego pola (F-14). */
function changesOf(item: Item, edited: { name: string; note: string | null }): UpdateItemRequest {
  return {
    ...(edited.name === item.name ? {} : { name: edited.name }),
    ...(edited.note === item.note ? {} : { note: edited.note }),
  };
}

export interface EditCallbacks {
  onSaved: () => void;
  /** Pozycji już nie ma: usunięta z arkusza albo wcześniej przez inną osobę (F-14). */
  onRemoved: () => void;
}

/**
 * Arkusz „Edytuj pozycję” (SC-06, F-07, F-09): zapis nazwy i notatki, usunięcie; zmiana
 * widoczna dopiero po odpowiedzi API (F-15).
 */
export function useEditItem(listId: string, item: Item, items: Item[], callbacks: EditCallbacks) {
  const client = useQueryClient();
  const [name, setName] = useState(item.name);
  const [note, setNote] = useState(item.note ?? "");
  const [fields, setFields] = useState<Fields>({});
  /** Nazwa pozycji, która już jest na liście (`dup.rename`). */
  const [duplicate, setDuplicate] = useState<string | null>(null);
  const [failure, setFailure] = useState<RequestErrorCode | null>(null);
  // F-14: usunięcie wygrywa z edycją; API odpowiada wtedy 404.
  const [deletedElsewhere, setDeletedElsewhere] = useState(false);
  const saving = useGuardedMutation({
    mutationFn: (changes: UpdateItemRequest) => updateItem(listId, item.id, changes),
  });
  const removal = useRemoveItem(listId, item, callbacks.onRemoved);

  const saved = (updated: Item) => {
    replaceItem(client, listId, updated);
    callbacks.onSaved();
  };

  const failed = (error: unknown, typed: string) => {
    const { code, fields: invalid } = asRequestError(error);
    if (code === "not_found") setDeletedElsewhere(true);
    else if (code === "duplicate_item") setDuplicate(typed);
    else if (code === "validation_failed") setFields(invalid);
    else setFailure(code);
  };

  const save = () => {
    setDuplicate(null);
    setFailure(null);
    const parsed = updateItemRequestSchema.safeParse({ name, note });
    setFields(parsed.success ? {} : fieldErrors(parsed.error));
    if (!parsed.success) return;
    const { name: newName = item.name, note: newNote = null } = parsed.data;
    const existing = sameNameAs(items, newName, item.id);
    if (existing) {
      setDuplicate(existing.name);
      return;
    }
    saving.mutate(changesOf(item, { name: newName, note: newNote }), {
      onSuccess: saved,
      onError: (error) => {
        failed(error, newName);
      },
    });
  };

  return {
    form: { name, setName, note, setNote, fields },
    duplicate,
    failure: failure ?? removal.failure,
    // F-14: usunięcie wygrywa z edycją, także gdy przyszło na żywo przed zapisem.
    deletedElsewhere:
      deletedElsewhere || (!removal.removing && !items.some(({ id }) => id === item.id)),
    save,
    remove: () => {
      setFailure(null);
      removal.remove();
    },
    removed: removal.removed,
    saving: saving.isPending,
    removing: removal.removing,
  };
}

export type EditItemState = ReturnType<typeof useEditItem>;

/** „Usuń pozycję” — od razu, bez potwierdzenia (SC-06). */
function useRemoveItem(listId: string, item: Item, onRemoved: () => void) {
  const client = useQueryClient();
  const [failure, setFailure] = useState<RequestErrorCode | null>(null);
  const mutation = useGuardedMutation({ mutationFn: () => deleteItem(listId, item.id) });

  const removed = () => {
    updateItems(client, listId, (all) => all.filter((it) => it.id !== item.id));
    onRemoved();
  };

  const remove = () => {
    setFailure(null);
    mutation.mutate(undefined, {
      onSuccess: removed,
      onError: (error) => {
        const { code } = asRequestError(error);
        // Usunięta wcześniej przez kogoś innego: skutek ten sam, co zamierzony.
        if (code === "not_found") removed();
        else setFailure(code);
      },
    });
  };

  return { remove, removed, failure, removing: mutation.isPending };
}
