import { ITEM_NAME_MAX_LENGTH, ITEM_NOTE_MAX_LENGTH } from "@lista/shared";
import { AddBar } from "../../components/AddBar/AddBar";
import { InlineAlert } from "../../components/InlineAlert/InlineAlert";
import { itemNameErrorText, itemNoteErrorText, messages, saveErrorText } from "./messages";
import type { AddItemState } from "./useAddItem";

/** AddBar SC-06 z komunikatami: duplikat, limit, błąd zapisu, długość pól. */
export function AddItemBar({ state, disabled }: { state: AddItemState; disabled: boolean }) {
  return (
    <AddBar
      label={messages.add.submitName}
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
      alert={<AddAlert state={state} />}
      pending={state.pending}
      disabled={disabled || state.limitReached}
      onSubmit={state.submit}
    />
  );
}

function AddAlert({ state }: { state: AddItemState }) {
  if (state.limitReached) return <InlineAlert tone="warning">{messages.limit}</InlineAlert>;
  if (state.warning?.kind === "duplicate") {
    return (
      <InlineAlert tone="warning" urgent>
        {messages.dupOpen(state.warning.name)}
      </InlineAlert>
    );
  }
  if (state.failure) return <InlineAlert tone="error">{saveErrorText(state.failure)}</InlineAlert>;
  return null;
}
