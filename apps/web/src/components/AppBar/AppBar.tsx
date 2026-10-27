import type { ReactNode } from "react";
import { Link } from "react-router";
import styles from "./AppBar.module.css";

interface AppBarProps {
  /** Tytuł paska jest nagłówkiem `h1` ekranu (design-system.md, AppBar). */
  title: string;
  back?: { to: string; label: string };
  actions?: ReactNode;
}

export function AppBar({ title, back, actions }: AppBarProps) {
  return (
    <header className={styles.bar}>
      <title>{`${title} · Wspólna lista zakupów`}</title>
      {back && (
        <Link className={styles.control} to={back.to}>
          <span aria-hidden="true">←</span> {back.label}
        </Link>
      )}
      <h1 className={styles.title}>{title}</h1>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
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
