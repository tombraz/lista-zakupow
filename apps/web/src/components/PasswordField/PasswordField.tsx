import { useState } from "react";
import { TextField, type TextFieldProps } from "../TextField/TextField";
import styles from "./PasswordField.module.css";

interface PasswordFieldProps extends Omit<TextFieldProps, "type" | "addon"> {
  autoComplete: "current-password" | "new-password";
}

/** Pole hasła z „Pokaż / Ukryj”; wklejanie i menedżery haseł działają (WCAG 3.3.8). */
export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      addon={
        <button
          type="button"
          className={styles.toggle}
          aria-pressed={visible}
          onClick={() => {
            setVisible((current) => !current);
          }}
        >
          {visible ? "Ukryj" : "Pokaż"}
        </button>
      }
    />
  );
}
