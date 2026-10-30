import { ITEM_NAME_MAX_LENGTH, ITEM_NOTE_MAX_LENGTH } from "@lista/shared";
import { useRef, type RefObject } from "react";
import { AddBar } from "../../components/AddBar/AddBar";
import { InlineAlert } from "../../components/InlineAlert/InlineAlert";
import { useLimitFocus } from "../../components/useFocus";
import { itemNameErrorText, itemNoteErrorText, messages, saveErrorText } from "./messages";
import styles from "./ListScreen.module.css";
import type { AddItemState } from "./useAddItem";

/** AddBar SC-06 z komunikatami: duplikat, limit, błąd zapisu, długość pól. */
interface AddItemBarProps {
  state: AddItemState;
  disabled: boolean;
  /** „Pokaż” przy duplikacie kupionej: rozwija „Kupione” z fokusem na tej pozycji. */
  onShowBought: (itemId: string) => void;
}

export function AddItemBar({ state, disabled, onShowBought }: AddItemBarProps) {
  const formRef = useRef<HTMLFormElement>(null);
  // Limit wyłącza pole i „Dodaj”, więc fokus z AddBar idzie na ostrzeżenie (T-023).
  const limitRef = useLimitFocus(state.limitReached, formRef);
  return (
    <AddBar
      label={messages.add.submitName}
      formRef={formRef}
      submitText={messages.add.submit}
      name={{
        ref: state.nameRef,
        label: messages.add.label,
        value: state.name,
        onChange: state.setName,
        error: state.fields.name ? itemNameErrorText(state.fields.name) : null,
        maxChars: ITEM_NAME_MAX_LENGTH,
      }}
      note={{
        label: messages.add.noteLabel,
        value: state.note,
        onChange: state.setNote,
        error: state.fields.note ? itemNoteErrorText() : null,
        maxChars: ITEM_NOTE_MAX_LENGTH,
      }}
      alert={<AddAlert state={state} onShowBought={onShowBought} limitRef={limitRef} />}
      pending={state.pending}
      disabled={disabled || state.limitReached}
      onSubmit={state.submit}
    />
  );
}

function AddAlert({
  state,
  onShowBought,
  limitRef,
}: Omit<AddItemBarProps, "disabled"> & { limitRef: RefObject<HTMLDivElement | null> }) {
  if (state.limitReached) {
    return (
      <InlineAlert ref={limitRef} tone="warning">
        {messages.limit}
      </InlineAlert>
    );
  }
  const bought = state.warning?.bought;
  if (bought) {
    return (
      <InlineAlert tone="warning" urgent>
        {messages.dupBought(bought.name)}{" "}
        <button
          type="button"
          className={styles.show}
          onClick={() => {
            onShowBought(bought.id);
          }}
        >
          {messages.dupShow}
        </button>
      </InlineAlert>
    );
  }
  if (state.warning) {
    return (
      <InlineAlert tone="warning" urgent>
        {messages.dupOpen(state.warning.name)}
      </InlineAlert>
    );
  }
  if (state.failure) return <InlineAlert tone="error">{saveErrorText(state.failure)}</InlineAlert>;
  return null;
}
