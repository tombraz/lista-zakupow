import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

/** Pusty stan: jedno zdanie + jedna akcja, bez ilustracji (design-system.md, EmptyState). */
export function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <p className={styles.text}>{text}</p>
      {action}
    </div>
  );
}
