import { NAME_MAX_LENGTH } from "@lista/shared";
import { useRef } from "react";
import { Button } from "../../components/Button/Button";
import { InlineAlert } from "../../components/InlineAlert/InlineAlert";
import { TextField } from "../../components/TextField/TextField";
import { Toast, useToast } from "../../components/Toast/Toast";
import { NAME_ERROR_TEXTS } from "../../session/personNameMessages";
import styles from "./AccountScreen.module.css";
import { messages, saveErrorText } from "./messages";
import { useNameChange } from "./useNameChange";

/** SC-09 „Twoje dane”: pole „Imię” i „Zapisz imię” (F-16). */
export function NameForm() {
  const toast = useToast();
  const fieldRef = useRef<HTMLInputElement>(null);
  const form = useNameChange(fieldRef, () => {
    toast.show(messages.nameSaved);
  });

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        form.submit();
      }}
    >
      {form.failure && <InlineAlert tone="error">{saveErrorText(form.failure)}</InlineAlert>}
      <TextField
        ref={fieldRef}
        label={messages.name}
        hint={messages.nameHint}
        autoComplete="given-name"
        maxChars={NAME_MAX_LENGTH}
        value={form.name}
        onChange={(event) => {
          form.setName(event.target.value);
        }}
        error={form.fieldError && NAME_ERROR_TEXTS[form.fieldError]}
      />
      <Button type="submit" variant="secondary" writes loading={form.pending}>
        {messages.nameSave}
      </Button>
      <Toast text={toast.text} />
    </form>
  );
}
