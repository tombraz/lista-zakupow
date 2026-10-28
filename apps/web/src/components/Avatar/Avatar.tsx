import type { Person } from "@lista/shared";
import { cx } from "../cx";
import styles from "./Avatar.module.css";

const PERSON_COLORS = 6;
const MAX_IN_STACK = 4;

/** Kolor `person.N` kolejno wg dołączenia do listy (design-system.md, Avatar). */
function colorClass(index: number): string | undefined {
  return styles[`person${String((index % PERSON_COLORS) + 1)}`];
}

/**
 * Awatar osoby przy pozycji (32 px). `index` = kolejność dołączenia do listy (właściciel 0);
 * osoba spoza listy albo usunięta (`null`) dostaje kolor neutralny.
 */
export function Avatar({ person, index }: { person: Person | null; index: number }) {
  return (
    <span
      className={cx(styles.avatar, styles.single, index < 0 ? styles.more : colorClass(index))}
      aria-hidden="true"
    >
      {person ? Array.from(person.name)[0]?.toLocaleUpperCase("pl-PL") : "?"}
    </span>
  );
}

/** Stos awatarów (28 px): maks. 4 + „+N”; dekoracyjny, bo imiona są w tekście obok. */
export function AvatarStack({ people }: { people: Person[] }) {
  if (people.length === 0) return null;
  const hidden = people.length - MAX_IN_STACK;
  return (
    <span className={styles.stack} aria-hidden="true">
      {people.slice(0, MAX_IN_STACK).map((person, index) => (
        <span key={person.id} className={cx(styles.avatar, colorClass(index))}>
          {Array.from(person.name)[0]?.toLocaleUpperCase("pl-PL")}
        </span>
      ))}
      {hidden > 0 && <span className={cx(styles.avatar, styles.more)}>+{hidden}</span>}
    </span>
  );
}
