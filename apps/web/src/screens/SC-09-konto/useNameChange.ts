import { nameChangeRequestSchema, type FieldErrorCode, type Me } from "@lista/shared";
import { useState, type RefObject } from "react";
import { changeName } from "../../api/account";
import { asRequestError, type RequestErrorCode } from "../../api/client";
import { useGuardedMutation } from "../../api/useGuardedMutation";
import { useFieldFocus } from "../../components/useFocus";
import { useSession, useSetSession } from "../../session/useSession";

interface NameChange {
  name: string;
  /** Treść pola w chwili zapisu: po odpowiedzi pole nie nadpisuje nowszego wpisu. */
  typed: string;
}

/**
 * F-16: pole „Imię” na SC-09. Bez własnego wpisu pole pokazuje imię z sesji; po zapisie nowe imię
 * trafia do sesji klienta, a pole wraca do niej, jeśli w trakcie zapisu nikt go nie zmienił.
 */
export function useNameChange(fieldRef: RefObject<HTMLInputElement | null>, onSaved: () => void) {
  const { data: me } = useSession();
  const setSession = useSetSession();
  const [draft, setDraft] = useState<string | null>(null);
  const [fieldError, setError] = useState<FieldErrorCode | null>(null);
  const [failure, setFailure] = useState<RequestErrorCode | null>(null);
  const focusField = useFieldFocus({ name: fieldRef });
  const setFieldError = (code: FieldErrorCode) => {
    setError(code);
    focusField("name");
  };
  const mutation = useGuardedMutation({
    mutationFn: ({ name }: NameChange) => changeName(name),
    onSuccess: (renamed: Me, { typed }) => {
      setSession(renamed);
      setDraft((current) => (current === typed ? null : current));
      onSaved();
    },
    onError: (error) => {
      const { code, fields } = asRequestError(error);
      if (fields["name"]) setFieldError(fields["name"]);
      else setFailure(code);
    },
  });
  const name = draft ?? me?.name ?? "";

  const submit = () => {
    setFailure(null);
    const parsed = nameChangeRequestSchema.safeParse({ name });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message as FieldErrorCode);
      return;
    }
    setError(null);
    mutation.mutate({ name: parsed.data.name, typed: name });
  };

  return {
    name,
    setName: setDraft,
    fieldError,
    failure,
    submit,
    pending: mutation.isPending,
  };
}
