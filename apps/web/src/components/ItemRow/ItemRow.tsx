import type { Person } from "@lista/shared";
import type { Ref } from "react";
import { Avatar } from "../Avatar/Avatar";
import styles from "./ItemRow.module.css";

interface ItemRowProps {
  name: string;
  /** Linia pod nazwą: „<ilość/notatka> · dodał(a) <imię>”. */
  details: string;
  person: Person | null;
  /** Kolejność osoby na liście dla koloru awatara; -1 = poza listą. */
  personIndex: number;
  /** Nazwa dostępna przycisku nazwy, np. „Edytuj Mleko”. */
  editLabel: string;
  /** Dostaje przycisk nazwy: arkusz zwraca na niego fokus po zamknięciu. */
  onEdit: (button: HTMLButtonElement) => void;
  editRef?: Ref<HTMLButtonElement>;
}

/** Wiersz pozycji (design-system.md, ItemRow); nazwa to przycisk otwierający arkusz edycji. */
export function ItemRow(props: ItemRowProps) {
  const { name, details, person, personIndex, editLabel, onEdit, editRef } = props;
  return (
    <li className={styles.row}>
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
    </li>
  );
}
