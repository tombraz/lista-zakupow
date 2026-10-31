import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { FieldError } from "../FieldError/FieldError";
import styles from "./ConsentCheckbox.module.css";

interface ConsentCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  error?: string | undefined;
  ref?: Ref<HTMLInputElement>;
}

/** Natywny checkbox; cała etykieta klikalna, obszar ≥ 48 px (design-system.md). */
export function ConsentCheckbox({ label, error, ref, ...input }: ConsentCheckboxProps) {
  const generatedId = useId();
  const id = input.id ?? generatedId;
  const errorId = `${id}-error`;
  return (
    <div className={styles.consent}>
      <label className={styles.label} htmlFor={id}>
        <input
          {...input}
          ref={ref}
          id={id}
          type="checkbox"
          className={styles.box}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <span>{label}</span>
      </label>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
