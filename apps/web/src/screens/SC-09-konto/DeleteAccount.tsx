import { useRef, useState } from "react";
import { asRequestError } from "../../api/client";
import { Button } from "../../components/Button/Button";
import { ConfirmDialog } from "../../components/ConfirmDialog/ConfirmDialog";
import { useLists } from "../../lists/useLists";
import styles from "./AccountScreen.module.css";
import { messages, saveErrorText } from "./messages";
import { useDeleteAccount } from "./useDeleteAccount";

/**
 * SC-09 „Usuń konto” (F-04): skutki, potwierdzenie z liczbą własnych list (aktualną: SC-05
 * odświeża się po `lists.changed`), błąd zapisu w oknie, którego w trakcie zapisu nie da się zamknąć.
 */
export function DeleteAccount() {
  const trigger = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  const removal = useDeleteAccount();
  const { data: lists } = useLists();
  const owned = lists?.filter(({ role }) => role === "owner").length;

  return (
    <section className={styles.danger} aria-labelledby="account-delete">
      <h2 id="account-delete">{messages.delete.section}</h2>
      <p>{messages.delete.body}</p>
      <Button
        ref={trigger}
        variant="danger"
        writes
        onClick={() => {
          removal.reset();
          setConfirming(true);
        }}
      >
        {messages.delete.action}
      </Button>
      {confirming && (
        <ConfirmDialog
          question={messages.delete.question}
          // Listy jeszcze się nie wczytały (albo nie udało się): ogólny opis skutków z sekcji.
          consequence={
            owned === undefined ? messages.delete.body : messages.delete.consequence(owned)
          }
          confirmLabel={messages.delete.confirm}
          cancelLabel={messages.cancel}
          pending={removal.isPending}
          error={removal.error && saveErrorText(asRequestError(removal.error).code)}
          onConfirm={() => {
            removal.mutate();
          }}
          onCancel={() => {
            if (!removal.isPending) setConfirming(false);
          }}
          returnFocus={trigger}
        />
      )}
    </section>
  );
}
