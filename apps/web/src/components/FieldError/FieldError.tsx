import type { ReactNode } from "react";
import styles from "./FieldError.module.css";

/** Błąd pod polem: ikona + tekst, powiązany z polem przez `id` (`aria-describedby`). */
export function FieldError({ id, children }: { id: string | undefined; children: ReactNode }) {
  return (
    <p id={id} className={styles.error}>
      {children}
    </p>
  );
}
