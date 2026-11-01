import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode, type Ref } from "react";
import { Link, useLocation } from "react-router";
import { useConnection } from "../../live/useConnection";
import { OfflineBanner } from "../OfflineBanner/OfflineBanner";
import styles from "./AppBar.module.css";

interface AppBarProps {
  /** Tytuł paska jest nagłówkiem `h1` ekranu (design-system.md, AppBar). */
  title: string;
  back?: { to: string; label: string };
  actions?: ReactNode;
}

/** Pasek nagłówka zalogowanej części (SC-05–SC-07, SC-09), pod nim OfflineBanner (F-15). */
export function AppBar({ title, back, actions }: AppBarProps) {
  const titleRef = useRouteFocus(title);
  const { online } = useConnection();
  return (
    <>
      <header className={styles.bar}>
        <title>{`${title} · Wspólna lista zakupów`}</title>
        {back && (
          <Link className={styles.control} to={back.to}>
            <span aria-hidden="true">←</span> {back.label}
          </Link>
        )}
        <h1 ref={titleRef} className={styles.title} tabIndex={-1}>
          {title}
        </h1>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      <OfflineBanner offline={!online} />
    </>
  );
}

/**
 * Po zmianie trasy fokus na `h1`, gdy ma już tekst, żeby czytnik ogłosił nowy ekran (WCAG 2.4.3).
 * Ekran, który sam ustawia fokus (pusty SC-06 → „Co kupić?”), robi to w efekcie elementu dalej w
 * drzewie, więc wygrywa.
 */
function useRouteFocus(title: string) {
  const ref = useRef<HTMLHeadingElement>(null);
  const { key } = useLocation();
  const named = title !== "";
  useEffect(() => {
    if (named) ref.current?.focus();
  }, [named, key]);
  return ref;
}

interface AppBarLinkProps {
  to: string;
  label: string;
  icon: string;
}

/** Przycisk-ikona na pasku marki jako link; nazwa dostępna = `label`. */
export function AppBarLink({ to, label, icon }: AppBarLinkProps) {
  return (
    <Link className={styles.control} to={to} aria-label={label}>
      <span aria-hidden="true">{icon}</span>
    </Link>
  );
}

interface AppBarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: string;
  ref?: Ref<HTMLButtonElement> | undefined;
}

/** Przycisk-ikona na pasku marki; nazwa dostępna = `label`. */
export function AppBarButton({ label, icon, ...button }: AppBarButtonProps) {
  return (
    <button type="button" {...button} className={styles.control} aria-label={label}>
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}
