import type { ReactNode, Ref } from "react";
import { cx } from "../cx";
import styles from "./InlineAlert.module.css";

const ICONS = { error: "⚠", warning: "⚠", success: "✓", info: "ℹ" } as const;

interface InlineAlertProps {
  tone: keyof typeof ICONS;
  /** Ogłoś jak błąd (`role="alert"`) mimo innego tonu, np. ostrzeżenie duplikatu (SC-06). */
  urgent?: boolean;
  children: ReactNode;
  ref?: Ref<HTMLDivElement> | undefined;
}

/** Komunikat w treści: ikona + tekst; błąd `role="alert"`, reszta `role="status"`. */
export function InlineAlert({ tone, urgent = false, children, ref }: InlineAlertProps) {
  return (
    <div
      ref={ref}
      className={cx(styles.alert, styles[tone])}
      role={tone === "error" || urgent ? "alert" : "status"}
      tabIndex={-1}
    >
      <span aria-hidden="true">{ICONS[tone]}</span>
      <div>{children}</div>
    </div>
  );
}
