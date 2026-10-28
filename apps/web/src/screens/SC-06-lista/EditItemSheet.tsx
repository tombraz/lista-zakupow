import { ITEM_NAME_MAX_LENGTH, ITEM_NOTE_MAX_LENGTH, type Item } from "@lista/shared";
import { useEffect, useRef, type RefObject } from "react";
import { Button } from "../../components/Button/Button";
import { InlineAlert } from "../../components/InlineAlert/InlineAlert";
import { Modal } from "../../components/Modal/Modal";
import { TextField } from "../../components/TextField/TextField";
import styles from "./ListScreen.module.css";
import { itemNameErrorText, itemNoteErrorText, messages, saveErrorText } from "./messages";
import { useEditItem, type EditCallbacks, type EditItemState } from "./useEditItem";

interface EditItemSheetProps extends EditCallbacks {
  listId: string;
  item: Item;
  /** Pozycje listy: lokalne sprawdzenie duplikatu nazwy (F-09). */
  items: Item[];
  /** Przycisk nazwy edytowanej pozycji: dostaje fokus po zamknięciu. */
  returnFocus: RefObject<HTMLElement | null>;
}

/** BottomSheet „Edytuj pozycję” (design-system.md): nazwa, ilość / notatka, zapis, usunięcie. */
export function EditItemSheet(props: EditItemSheetProps) {
  const { listId, item, items, returnFocus, onSaved, onRemoved } = props;
  const nameRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const edit = useEditItem(listId, item, items, { onSaved, onRemoved });
  return (
    <Modal
      role="dialog"
      variant="sheet"
      title={messages.editSheet.title}
      onClose={edit.deletedElsewhere ? edit.removed : onSaved}
      initialFocus={nameRef}
      returnFocus={returnFocus}
    >
      {edit.deletedElsewhere ? (
        <DeletedElsewhere closeRef={closeRef} onClose={edit.removed} />
      ) : (
        <EditForm edit={edit} nameRef={nameRef} onCancel={onSaved} />
      )}
    </Modal>
  );
}

interface EditFormProps {
  edit: EditItemState;
  nameRef: RefObject<HTMLInputElement | null>;
  onCancel: () => void;
}

function EditForm({ edit, nameRef, onCancel }: EditFormProps) {
  const { form } = edit;
  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        edit.save();
      }}
    >
      <SheetAlert edit={edit} />
      <TextField
        ref={nameRef}
        label={messages.editSheet.name}
        value={form.name}
        maxChars={ITEM_NAME_MAX_LENGTH}
        error={form.fields.name && itemNameErrorText(form.fields.name)}
        onChange={(event) => {
          form.setName(event.target.value);
        }}
      />
      <TextField
        label={messages.add.noteLabel}
        value={form.note}
        maxChars={ITEM_NOTE_MAX_LENGTH}
        error={form.fields.note && itemNoteErrorText()}
        onChange={(event) => {
          form.setNote(event.target.value);
        }}
      />
      <Button type="submit" loading={edit.saving} disabled={edit.removing}>
        {messages.editSheet.save}
      </Button>
      <Button variant="danger" loading={edit.removing} disabled={edit.saving} onClick={edit.remove}>
        {messages.editSheet.delete}
      </Button>
      <Button variant="secondary" onClick={onCancel}>
        {messages.cancel}
      </Button>
    </form>
  );
}

function SheetAlert({ edit }: { edit: EditItemState }) {
  if (edit.duplicate) {
    return (
      <InlineAlert tone="warning" urgent>
        {messages.dupRename(edit.duplicate)}
      </InlineAlert>
    );
  }
  if (edit.failure) return <InlineAlert tone="error">{saveErrorText(edit.failure)}</InlineAlert>;
  return null;
}

interface DeletedElsewhereProps {
  closeRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}

/** SC-06 „Edycja usuniętej pozycji”: usunięcie wygrywa z edycją (F-14). */
function DeletedElsewhere({ closeRef, onClose }: DeletedElsewhereProps) {
  // Pole z fokusem znika razem z formularzem: fokus na jedyną akcję.
  useEffect(() => {
    closeRef.current?.focus();
  }, [closeRef]);
  return (
    <>
      <InlineAlert tone="info">{messages.editSheet.deleted}</InlineAlert>
      <Button ref={closeRef} onClick={onClose}>
        {messages.editSheet.close}
      </Button>
    </>
  );
}
