import type { ReactNode } from "react";
import styles from "./AuthPage.module.css";

interface AuthFormProps {
  /** Wysłanie formularza (przycisk albo Enter w polu); walidację robi ekran, nie przeglądarka. */
  onSubmit: () => void;
  children: ReactNode;
}

/** Formularz ekranów wejściowych (SC-01, SC-03): pola i przycisk w kolumnie. */
export function AuthForm({ onSubmit, children }: AuthFormProps) {
  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}
