import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import styles from "./Modal.module.css";

const FOCUSABLE =
  "button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])";

interface ModalProps {
  /** `alertdialog` dla potwierdzeń (ConfirmDialog), `dialog` dla arkuszy (BottomSheet). */
  role: "dialog" | "alertdialog";
  variant: "sheet" | "dialog";
  title: string;
  description?: string;
  onClose: () => void;
  /** Element z fokusem po otwarciu. */
  initialFocus: RefObject<HTMLElement | null>;
  /** Element, który dostaje fokus po zamknięciu (przycisk wywołujący). */
  returnFocus: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/** Okno modalne: pułapka fokusu, Esc zamyka, fokus wraca na wywołujący (design-system.md). */
export function Modal(props: ModalProps) {
  const { role, variant, title, description, onClose, initialFocus, returnFocus, children } = props;
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initialFocus.current?.focus();
    const trigger = returnFocus.current;
    return () => {
      trigger?.focus();
    };
    // Tylko przy otwarciu i zamknięciu; refy są stałe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      } else if (event.key === "Tab") {
        trapFocus(dialog, event);
      }
    };
    dialog.addEventListener("keydown", onKeyDown);
    return () => {
      dialog.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className={styles.backdrop}>
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={styles[variant]}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className={styles.description}>
            {description}
          </p>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

function trapFocus(dialog: HTMLElement, event: KeyboardEvent) {
  const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
