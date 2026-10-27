import type { ReactNode, Ref } from "react";
import { cx } from "../cx";
import styles from "./InlineAlert.module.css";

const ICONS = { error: "⚠", warning: "⚠", success: "✓", info: "ℹ" } as const;

interface InlineAlertProps {
  tone: keyof typeof ICONS;
  children: ReactNode;
  ref?: Ref<HTMLDivElement> | undefined;
}

/** Komunikat w treści: ikona + tekst; błąd `role="alert"`, reszta `role="status"`. */
export function InlineAlert({ tone, children, ref }: InlineAlertProps) {
  return (
    <div
      ref={ref}
      className={cx(styles.alert, styles[tone])}
      role={tone === "error" ? "alert" : "status"}
      tabIndex={-1}
    >
      <span aria-hidden="true">{ICONS[tone]}</span>
      <div>{children}</div>
    </div>
  );
}
