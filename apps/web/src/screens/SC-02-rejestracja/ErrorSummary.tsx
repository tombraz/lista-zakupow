import type { Ref } from "react";
import { InlineAlert } from "../../components/InlineAlert/InlineAlert";
import { fixFields, type SignUpField } from "./messages";
import type { FieldErrors } from "./useSignUpForm";

interface ErrorSummaryProps {
  errors: FieldErrors;
  text: (field: SignUpField) => string | undefined;
  ids: Record<SignUpField, string>;
  ref?: Ref<HTMLDivElement>;
}

/** „Popraw N pól” z linkami do pól; dostaje fokus po wysłaniu z błędami (SC-02). */
export function ErrorSummary({ errors, text, ids, ref }: ErrorSummaryProps) {
  const fields = (Object.keys(errors) as SignUpField[]).filter((field) => text(field));
  return (
    <InlineAlert tone="error" ref={ref}>
      <p>{fixFields(fields.length)}</p>
      <ul>
        {fields.map((field) => (
          <li key={field}>
            <a
              href={`#${ids[field]}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(ids[field])?.focus();
              }}
            >
              {text(field)}
            </a>
          </li>
        ))}
      </ul>
    </InlineAlert>
  );
}
