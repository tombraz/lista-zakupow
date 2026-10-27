import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { cx } from "../cx";
import { FieldError } from "../FieldError/FieldError";
import styles from "./TextField.module.css";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id?: string;
  label: string;
  hint?: string;
  error?: ReactNode;
  /** Limit znaków: licznik pokazywany od 80 % (design-system.md, TextField). */
  maxChars?: number;
  /** Element obok pola (np. „Pokaż” w polu hasła). */
  addon?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export function TextField(props: TextFieldProps) {
  const { id, label, hint, error, maxChars, addon, ref, ...input } = props;
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ");

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <div className={styles.control}>
        <input
          {...input}
          ref={ref}
          id={inputId}
          className={cx(styles.input, Boolean(error) && styles.invalid)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
        />
        {addon}
      </div>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      <CharCounter value={input.value} max={maxChars} />
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

function CharCounter({ value, max }: { value: unknown; max: number | undefined }) {
  // Znaki jak w bazie (char_length) i w zod: punkty kodowe, nie jednostki UTF-16.
  const length = typeof value === "string" ? Array.from(value).length : 0;
  if (max === undefined || length < max * 0.8) return null;
  return (
    <p className={styles.hint} aria-hidden="true">
      {length}/{max}
    </p>
  );
}
