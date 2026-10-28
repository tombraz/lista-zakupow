import type { ReactNode, Ref } from "react";
import { Button } from "../Button/Button";
import { TextField } from "../TextField/TextField";
import styles from "./AddBar.module.css";

export interface AddBarField {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  maxChars: number;
}

interface AddBarProps {
  /** Nazwa dostępna formularza (landmark) i przycisku. */
  label: string;
  name: AddBarField & { ref: Ref<HTMLInputElement> };
  /** Pole ilości / notatki: pokazywane dopiero po wpisaniu nazwy (design-system.md, AddBar). */
  note: AddBarField;
  submitText: string;
  /** Ostrzeżenie lub błąd nad polami (duplikat, limit, błąd zapisu). */
  alert: ReactNode;
  pending: boolean;
  disabled: boolean;
  onSubmit: () => void;
}

/** Pasek dodawania na dole SC-06: Enter lub „Dodaj” wysyła (design-system.md, AddBar). */
export function AddBar(props: AddBarProps) {
  const { label, name, note, submitText, alert, pending, disabled, onSubmit } = props;
  const showNote = name.value !== "" || note.value !== "";
  return (
    <form
      className={styles.bar}
      aria-label={label}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!pending) onSubmit();
      }}
    >
      {alert}
      <div className={styles.row}>
        <AddBarInput field={name} inputRef={name.ref} disabled={disabled} />
        <Button
          type="submit"
          variant="accent"
          aria-label={label}
          loading={pending}
          disabled={disabled}
        >
          {submitText}
        </Button>
      </div>
      {showNote && <AddBarInput field={note} disabled={disabled} />}
    </form>
  );
}

interface AddBarInputProps {
  field: AddBarField;
  disabled: boolean;
  inputRef?: Ref<HTMLInputElement> | undefined;
}

function AddBarInput({ field, disabled, inputRef }: AddBarInputProps) {
  return (
    <TextField
      ref={inputRef}
      variant="onBrand"
      label={field.label}
      value={field.value}
      maxChars={field.maxChars}
      disabled={disabled}
      error={field.error}
      onChange={(event) => {
        field.onChange(event.target.value);
      }}
    />
  );
}
