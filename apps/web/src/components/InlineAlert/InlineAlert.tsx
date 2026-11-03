import { useEffect, useState, type ReactNode, type Ref } from "react";
import { cx } from "../cx";
import styles from "./InlineAlert.module.css";

const ICONS = { error: "⚠", warning: "⚠", success: "✓", info: "ℹ" } as const;

/**
 * Po tylu ms od zamontowania sukces dostaje tekst przekazany już przy wejściu na ekran: region
 * musi być w drzewie dostępności przed treścią, inaczej czytnik go nie ogłasza (T-071).
 */
export const SUCCESS_ANNOUNCE_DELAY_MS = 100;

interface InlineAlertProps {
  tone: keyof typeof ICONS;
  /** Ogłoś jak błąd (`role="alert"`) mimo innego tonu, np. ostrzeżenie duplikatu (SC-06). */
  urgent?: boolean;
  /** `success`: pusta treść (`null`, `false`, `""`) zostawia pusty, ukryty region `status`. */
  children: ReactNode;
  ref?: Ref<HTMLDivElement> | undefined;
}

/**
 * Komunikat w treści: ikona + tekst; błąd `role="alert"`, reszta `role="status"`.
 * Sukces renderuj zawsze (bez `cond && …`): region `status` jest w drzewie przed tekstem, więc
 * czytnik ogłasza i komunikat przy wejściu na ekran, i ponowienie z tą samą treścią po
 * wyczyszczeniu (T-071, layers/web.md „Pułapki”).
 */
export function InlineAlert({ tone, urgent = false, children, ref }: InlineAlertProps) {
  const ready = useReady(tone === "success");
  const empty =
    !ready || children === null || children === undefined || children === false || children === "";
  if (tone === "success" && empty) {
    return <div ref={ref} className={styles.empty} role="status" tabIndex={-1} />;
  }
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

/** `false` do `SUCCESS_ANNOUNCE_DELAY_MS` po zamontowaniu, gdy `deferred`; inaczej od razu `true`. */
function useReady(deferred: boolean): boolean {
  const [ready, setReady] = useState(!deferred);
  useEffect(() => {
    if (ready) return undefined;
    const timer = setTimeout(() => {
      setReady(true);
    }, SUCCESS_ANNOUNCE_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [ready]);
  return ready;
}
