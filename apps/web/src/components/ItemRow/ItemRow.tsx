import type { Person } from "@lista/shared";
import type { Ref } from "react";
import { Avatar } from "../Avatar/Avatar";
import styles from "./ItemRow.module.css";

/** Checkbox odhaczenia (design-system.md, ItemRow): `button` z `aria-pressed`. */
export interface ItemCheckbox {
  checked: boolean;
  /** „Odhacz <nazwa>” / „Odznacz <nazwa>”. */
  label: string;
  /** Zapis w toku: pozycja nie zmienia sekcji do odpowiedzi API (F-15). */
  saving: boolean;
  onToggle: () => void;
}

interface ItemRowProps {
  name: string;
  /** Linia pod nazwą: „<ilość/notatka> · dodał(a) <imię>” albo „… · kupił(a) <imię>”. */
  details: string;
  /** Osoba, która dodała (nieodhaczona) albo odhaczyła (odhaczona) pozycję. */
  person: Person | null;
  /** Kolejność osoby na liście dla koloru awatara; -1 = poza listą. */
  personIndex: number;
  /** Nazwa dostępna przycisku nazwy, np. „Edytuj Mleko”. */
  editLabel: string;
  /** Dostaje przycisk nazwy: arkusz zwraca na niego fokus po zamknięciu. */
  onEdit: (button: HTMLButtonElement) => void;
  editRef?: Ref<HTMLButtonElement>;
  checkbox: ItemCheckbox;
  /** Fokus po odhaczeniu przenosi się na checkbox innej pozycji. */
  checkboxRef?: Ref<HTMLButtonElement>;
}

/**
 * Wiersz pozycji (design-system.md, ItemRow): nazwa to przycisk otwierający arkusz edycji,
 * checkbox po prawej odhacza; odhaczona ma nazwę przekreśloną.
 */
export function ItemRow(props: ItemRowProps) {
  const { name, details, person, personIndex, editLabel, onEdit, editRef } = props;
  const { checkbox, checkboxRef } = props;
  return (
    <li className={styles.row} data-checked={checkbox.checked}>
      <Avatar person={person} index={personIndex} />
      <div className={styles.text}>
        <button
          ref={editRef}
          type="button"
          className={styles.name}
          aria-label={editLabel}
          onClick={(event) => {
            onEdit(event.currentTarget);
          }}
        >
          {name}
        </button>
        <p className={styles.details}>{details}</p>
      </div>
      <button
        ref={checkboxRef}
        type="button"
        className={styles.checkbox}
        aria-label={checkbox.label}
        aria-pressed={checkbox.checked}
        // Bez `disabled`: fokus zostaje na checkboxie w czasie zapisu.
        aria-busy={checkbox.saving || undefined}
        onClick={() => {
          if (!checkbox.saving) checkbox.onToggle();
        }}
      >
        <span className={styles.box} aria-hidden="true">
          {checkbox.saving ? <span className={styles.spinner} /> : checkbox.checked && "✓"}
        </span>
      </button>
    </li>
  );
}
