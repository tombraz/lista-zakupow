import type { Item, ListDetails } from "@lista/shared";
import { useEffect, useRef, useState, type RefObject } from "react";
import { EmptyState } from "../../components/EmptyState/EmptyState";
import { ItemRow } from "../../components/ItemRow/ItemRow";
import { EditItemSheet } from "./EditItemSheet";
import styles from "./ListScreen.module.css";
import { addedByText, messages } from "./messages";

interface ItemsProps {
  list: ListDetails;
  /** Pole „Co kupić?”: fokus po usunięciu ostatniej pozycji. */
  addNameRef: RefObject<HTMLInputElement | null>;
}

/**
 * Nieodhaczone pozycje, od najnowszej (kolejność z API), albo pusty stan; nazwa otwiera arkusz
 * edycji. Pusty stan jest tu, nie wyżej: po usunięciu ostatniej pozycji fokus trafia do AddBar.
 */
export function Items({ list, addNameRef }: ItemsProps) {
  const people = [list.owner, ...list.members];
  const [editing, setEditing] = useState<Item | null>(null);
  const focus = useFocusAfterRemoval(list.items, addNameRef);
  return (
    <section aria-labelledby="to-buy">
      <h2 id="to-buy" className={styles.visuallyHidden}>
        {messages.toBuyHeading}
      </h2>
      {list.items.length === 0 ? (
        <EmptyState text={messages.empty} />
      ) : (
        <ul className={styles.items} aria-labelledby="to-buy">
          {list.items.map((item) => (
            <ItemRow
              key={item.id}
              name={item.name}
              details={[item.note, addedByText(item.addedBy)].filter(Boolean).join(" · ")}
              person={item.addedBy}
              personIndex={people.findIndex((person) => person.id === item.addedBy?.id)}
              editLabel={messages.edit(item.name)}
              editRef={focus.register(item.id)}
              onEdit={(button) => {
                focus.trigger.current = button;
                setEditing(item);
              }}
            />
          ))}
        </ul>
      )}
      {editing && (
        <EditItemSheet
          listId={list.id}
          item={editing}
          items={list.items}
          returnFocus={focus.trigger}
          onSaved={() => {
            setEditing(null);
          }}
          onRemoved={() => {
            focus.afterRemoving(editing.id);
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

/**
 * SC-06 „Accessibility”: po usunięciu fokus na następnej pozycji, przy ostatniej na poprzedniej,
 * przy pustej liście w polu „Co kupić?”. Arkusz oddaje fokus na `trigger` po zwykłym zamknięciu.
 */
function useFocusAfterRemoval(items: Item[], addNameRef: RefObject<HTMLInputElement | null>) {
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [target, setTarget] = useState<{ id: string | null } | null>(null);

  useEffect(() => {
    if (!target) return;
    const button = target.id === null ? null : buttons.current.get(target.id);
    (button ?? addNameRef.current)?.focus();
  }, [target, addNameRef]);

  return {
    trigger,
    register: (id: string) => (button: HTMLButtonElement | null) => {
      if (button) buttons.current.set(id, button);
      else buttons.current.delete(id);
    },
    afterRemoving: (id: string) => {
      const index = items.findIndex((item) => item.id === id);
      const neighbour = items[index + 1] ?? items[index - 1];
      setTarget({ id: neighbour?.id ?? null });
    },
  };
}
