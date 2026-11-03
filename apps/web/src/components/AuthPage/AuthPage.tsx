import type { ReactNode, Ref } from "react";
import { Link } from "react-router";
import styles from "./AuthPage.module.css";

interface AuthPageProps {
  title: string;
  children: ReactNode;
  /** SC-02: dokumenty w nowej karcie, żeby wypełniony formularz został. */
  legalInNewTab?: boolean;
  /** Ekran, który przenosi fokus na nagłówek (SC-03 po „Wyślij nowy link”). */
  titleRef?: Ref<HTMLHeadingElement>;
}

/** Układ SC-01, SC-02: jasne tło, kolumna `content-max`, nazwa aplikacji i `h1`. */
export function AuthPage({ title, children, legalInNewTab = false, titleRef }: AuthPageProps) {
  return (
    <main className={styles.page}>
      <title>{`${title} · Wspólna lista zakupów`}</title>
      <p className={styles.product}>Wspólna lista zakupów</p>
      <h1 className={styles.title} ref={titleRef} tabIndex={titleRef ? -1 : undefined}>
        {title}
      </h1>
      {children}
      <footer className={styles.footer}>
        <Link to="/regulamin" {...(legalInNewTab ? { target: "_blank", rel: "noopener" } : {})}>
          Regulamin i polityka prywatności
        </Link>
      </footer>
    </main>
  );
}
