import { useEffect, useRef, useState } from "react";
import styles from "./Toast.module.css";

// design-system.md, Toast: znika po 5 s.
const VISIBLE_MS = 5000;

/** Komunikat chwilowy; region `status` istnieje zawsze, żeby czytnik ogłosił nową treść. */
export function Toast({ text }: { text: string | null }) {
  return (
    <div className={styles.region} role="status">
      {text && <p className={styles.toast}>{text}</p>}
    </div>
  );
}

/** Tekst Toastu: `show` pokazuje go na 5 s (kolejne `show` liczy czas od nowa). */
export function useToast() {
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );
  const show = (message: string) => {
    clearTimeout(timer.current);
    setText(message);
    timer.current = setTimeout(() => {
      setText(null);
    }, VISIBLE_MS);
  };
  return { text, show };
}
