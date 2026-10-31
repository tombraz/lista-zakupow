import { useEffect, useId, useRef, useState } from "react";
import { Button } from "../Button/Button";
import styles from "./InviteLinkBox.module.css";

interface InviteLinkBoxProps {
  /** „Link jednorazowy, ważny do <data>” — nazwa grupy i pola z linkiem. */
  description: string;
  url: string;
  copyLabel: string;
  revokeLabel: string;
  /** Tekst, gdy schowek nie działa: link jest wtedy zaznaczony w polu. */
  manualCopyText: string;
  /** Fokus na „Kopiuj” po pojawieniu się (nowy link, SC-07). */
  focusCopy?: boolean;
  /** `false` — schowek niedostępny, użytkownik kopiuje ręcznie. */
  onCopy: (url: string) => Promise<boolean>;
  onRevoke: () => void;
  revoking?: boolean;
}

/** Pole linku zaproszenia (design-system.md, InviteLinkBox). */
export function InviteLinkBox(props: InviteLinkBoxProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const copyRef = useRef<HTMLButtonElement>(null);
  const [manualCopy, setManualCopy] = useState(false);
  const { focusCopy = false } = props;
  useEffect(() => {
    if (focusCopy) copyRef.current?.focus();
  }, [focusCopy]);

  const copy = async () => {
    const copied = await props.onCopy(props.url);
    setManualCopy(!copied);
    if (copied) return;
    // SC-07, „Error — kopiowanie”: link zaznaczony, do skopiowania ręcznie.
    inputRef.current?.focus();
    inputRef.current?.select();
  };

  return (
    <div className={styles.box} role="group" aria-labelledby={`${id}-label`}>
      <label id={`${id}-label`} htmlFor={`${id}-url`} className={styles.description}>
        {props.description}
      </label>
      <input
        ref={inputRef}
        id={`${id}-url`}
        className={styles.url}
        value={props.url}
        readOnly
        onFocus={(event) => {
          event.currentTarget.select();
        }}
      />
      {manualCopy && (
        <p className={styles.manual} role="status">
          {props.manualCopyText}
        </p>
      )}
      <div className={styles.actions}>
        <Button ref={copyRef} variant="secondary" onClick={() => void copy()}>
          {props.copyLabel}
        </Button>
        <Button variant="danger" loading={props.revoking ?? false} onClick={props.onRevoke}>
          {props.revokeLabel}
        </Button>
      </div>
    </div>
  );
}
