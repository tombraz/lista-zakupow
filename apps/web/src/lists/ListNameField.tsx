import type { FieldErrorCode } from "@lista/shared";
import { TextField, type TextFieldProps } from "../components/TextField/TextField";
import { LIST_NAME_MAX_LENGTH, listNameErrorText } from "./listName";

type ListNameFieldProps = Omit<TextFieldProps, "value" | "onChange" | "error" | "maxChars"> & {
  state: { name: string; setName: (name: string) => void; fieldError: FieldErrorCode | null };
};

/** Pole nazwy listy (F-05): licznik do 100 znaków i błędy z SC-05 („Error — nazwa”). */
export function ListNameField({ state, ...field }: ListNameFieldProps) {
  return (
    <TextField
      {...field}
      maxChars={LIST_NAME_MAX_LENGTH}
      value={state.name}
      onChange={(event) => {
        state.setName(event.target.value);
      }}
      error={state.fieldError && listNameErrorText(state.fieldError)}
    />
  );
}
