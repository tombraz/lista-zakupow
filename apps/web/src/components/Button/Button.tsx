import type { ButtonHTMLAttributes, Ref } from "react";
import { useConnection } from "../../live/useConnection";
import { cx } from "../cx";
import { OFFLINE_BANNER_ID } from "../OfflineBanner/OfflineBanner";
import styles from "./Button.module.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `accent` tylko na pasku dodawania (design-system.md, Button). */
  variant?: "primary" | "secondary" | "danger" | "accent";
  /**
   * Stan ładowania: etykieta zostaje, obok wskaźnik; przycisk nieaktywny przez `aria-disabled`,
   * nie `disabled`, który zabiera fokus (T-015, WCAG 2.4.3).
   */
  loading?: boolean;
  /**
   * Akcja zapisu (albo prowadząca wprost do zapisu): bez połączenia nieaktywna przez
   * `aria-disabled`, z paskiem „Brak połączenia” jako opisem (F-15).
   */
  writes?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button(props: ButtonProps) {
  const { variant = "primary", loading = false, writes = false, children, ...button } = props;
  const { online } = useConnection();
  const offline = writes && !online;
  const inactive = loading || offline;
  return (
    <button
      type="button"
      {...button}
      className={cx(styles.button, styles[variant])}
      aria-disabled={inactive || undefined}
      aria-busy={loading || undefined}
      aria-describedby={offline ? OFFLINE_BANNER_ID : button["aria-describedby"]}
      onClick={(event) => {
        // Także niejawne wysłanie formularza (Enter w polu) przechodzi przez kliknięcie przycisku.
        if (inactive) event.preventDefault();
        else button.onClick?.(event);
      }}
    >
      {children}
      {loading && <span className={styles.spinner} aria-hidden="true" />}
    </button>
  );
}
