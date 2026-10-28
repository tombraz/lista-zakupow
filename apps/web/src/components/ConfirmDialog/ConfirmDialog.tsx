import { useRef, type RefObject } from "react";
import { Button } from "../Button/Button";
import { InlineAlert } from "../InlineAlert/InlineAlert";
import { Modal } from "../Modal/Modal";
import styles from "./ConfirmDialog.module.css";

interface ConfirmDialogProps {
  question: string;
  consequence: string;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  /** Komunikat nieudanej akcji; okno zostaje otwarte. */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  returnFocus: RefObject<HTMLElement | null>;
}

/**
 * Potwierdzenie akcji nieodwracalnej: pytanie, jedno zdanie skutku, akcja z czasownikiem,
 * „Anuluj” z fokusem startowym; Esc = Anuluj (design-system.md, ConfirmDialog).
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const { question, consequence, confirmLabel, cancelLabel, pending = false, error } = props;
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Modal
      role="alertdialog"
      variant="dialog"
      title={question}
      description={consequence}
      onClose={props.onCancel}
      initialFocus={cancelRef}
      returnFocus={props.returnFocus}
    >
      {error && <InlineAlert tone="error">{error}</InlineAlert>}
      <div className={styles.actions}>
        <Button variant="danger" loading={pending} onClick={props.onConfirm}>
          {confirmLabel}
        </Button>
        <Button ref={cancelRef} variant="secondary" onClick={props.onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </Modal>
  );
}
