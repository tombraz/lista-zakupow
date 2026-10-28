import type { Item, ListDetails, Person } from "@lista/shared";
import { useEffect, useRef, useState, type Ref, type RefObject } from "react";
import { EmptyState } from "../../components/EmptyState/EmptyState";
import { ItemRow } from "../../components/ItemRow/ItemRow";
import { BoughtSection } from "./BoughtSection";
import { EditItemSheet } from "./EditItemSheet";
import styles from "./ListScreen.module.css";
import { addedByText, boughtByText, messages } from "./messages";
import type { CheckboxFocus } from "./useCheckboxFocus";
import type { CheckItemState } from "./useCheckItem";

interface ItemsProps {
  list: ListDetails;
  /** Pole „Co kupić?”: fokus po usunięciu ostatniej pozycji. */
  addNameRef: RefObject<HTMLInputElement | null>;
  checking: CheckItemState;
  checkboxFocus: CheckboxFocus;
  bought: { open: boolean; setOpen: (open: boolean) => void };
}

/**
 * Nieodhaczone pozycje (od najnowszej) albo pusty stan, pod nimi sekcja „Kupione”; nazwa
 * otwiera arkusz edycji, checkbox odhacza. Pusty stan jest tu, nie wyżej: po usunięciu ostatniej
 * pozycji fokus trafia do AddBar.
 */
export function Items({ list, addNameRef, checking, checkboxFocus, bought }: ItemsProps) {
  const people: Person[] = [list.owner, ...list.members];
  const [editing, setEditing] = useState<Item | null>(null);
  const focus = useFocusAfterRemoval(list.items, addNameRef);
  const toBuy = list.items.filter((item) => !item.checked);
  const checked = list.items.filter((item) => item.checked);
  // SC-06 Empty: pusta lista otwiera się z fokusem w „Co kupić?” — tylko przy wejściu, bo zmiany
  // innych osób nie przenoszą fokusu.
  const openedEmpty = useRef(list.items.length === 0);
  useEffect(() => {
    if (openedEmpty.current) addNameRef.current?.focus();
  }, [addNameRef]);

  const row = (item: Item) => (
    <Row
      key={item.id}
      item={item}
      people={people}
      checking={checking}
      checkboxRef={checkboxFocus.register(item.id)}
      editRef={focus.register(item.id)}
      onEdit={(button) => {
        focus.trigger.current = button;
        setEditing(item);
      }}
    />
  );

  return (
    <>
      <section aria-labelledby="to-buy">
        <h2 id="to-buy" className={styles.visuallyHidden}>
          {messages.toBuyHeading}
        </h2>
        {list.items.length === 0 && <EmptyState text={messages.empty} />}
        {toBuy.length > 0 && (
          <ul className={styles.items} aria-labelledby="to-buy">
            {toBuy.map(row)}
          </ul>
        )}
      </section>
      {checked.length > 0 && (
        <BoughtSection
          listId={list.id}
          items={checked}
          open={bought.open}
          onToggle={() => {
            bought.setOpen(!bought.open);
          }}
          toggleRef={checkboxFocus.boughtToggle}
          onCleared={focus.toAddBar}
        >
          {checked.map(row)}
        </BoughtSection>
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
    </>
  );
}

interface RowProps {
  item: Item;
  /** Właściciel i uczestnicy w kolejności dołączenia (kolor awatara). */
  people: Person[];
  checking: CheckItemState;
  checkboxRef: Ref<HTMLButtonElement>;
  editRef: Ref<HTMLButtonElement>;
  onEdit: (button: HTMLButtonElement) => void;
}

/** Wiersz pozycji; odhaczona ma awatar i podpis osoby, która kupiła (F-10). */
function Row({ item, people, checking, checkboxRef, editRef, onEdit }: RowProps) {
  const person = item.checked ? item.checkedBy : item.addedBy;
  const signature = item.checked ? boughtByText(item.checkedBy) : addedByText(item.addedBy);
  return (
    <ItemRow
      name={item.name}
      details={[item.note, signature].filter(Boolean).join(" · ")}
      person={person}
      personIndex={people.findIndex(({ id }) => id === person?.id)}
      editLabel={messages.edit(item.name)}
      editRef={editRef}
      onEdit={onEdit}
      checkbox={{
        checked: item.checked,
        label: (item.checked ? messages.uncheck : messages.check)(item.name),
        saving: checking.isSaving(item.id),
        onToggle: () => {
          checking.toggle(item);
        },
      }}
      checkboxRef={checkboxRef}
    />
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
    /** Fokus w polu „Co kupić?” (np. po usunięciu kupionych). */
    toAddBar: () => {
      setTarget({ id: null });
    },
    afterRemoving: (id: string) => {
      const index = items.findIndex((item) => item.id === id);
      const neighbour = items[index + 1] ?? items[index - 1];
      setTarget({ id: neighbour?.id ?? null });
    },
  };
}
