import type { ButtonHTMLAttributes, Ref } from "react";
import { cx } from "../cx";
import styles from "./Button.module.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `accent` tylko na pasku dodawania (design-system.md, Button). */
  variant?: "primary" | "secondary" | "danger" | "accent";
  /**
   * Stan ładowania: etykieta zostaje, obok wskaźnik; przycisk nieaktywny przez `aria-disabled`,
   * nie `disabled`, który zabiera fokus (T-015, WCAG 2.4.3).
   */
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({ variant = "primary", loading = false, children, ...button }: ButtonProps) {
  return (
    <button
      type="button"
      {...button}
      className={cx(styles.button, styles[variant])}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={(event) => {
        // Także niejawne wysłanie formularza (Enter w polu) przechodzi przez kliknięcie przycisku.
        if (loading) event.preventDefault();
        else button.onClick?.(event);
      }}
    >
      {children}
      {loading && <span className={styles.spinner} aria-hidden="true" />}
    </button>
  );
}
