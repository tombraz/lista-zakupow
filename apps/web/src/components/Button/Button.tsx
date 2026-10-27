import type { ButtonHTMLAttributes } from "react";
import { cx } from "../cx";
import styles from "./Button.module.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  /** Stan ładowania: etykieta zostaje, obok wskaźnik; przycisk nieaktywny. */
  loading?: boolean;
}

export function Button({ variant = "primary", loading = false, children, ...button }: ButtonProps) {
  return (
    <button
      type="button"
      {...button}
      className={cx(styles.button, styles[variant])}
      disabled={loading || button.disabled}
      aria-busy={loading || undefined}
    >
      {children}
      {loading && <span className={styles.spinner} aria-hidden="true" />}
    </button>
  );
}
