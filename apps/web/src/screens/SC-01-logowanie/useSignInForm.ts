import { fieldErrors, signInRequestSchema } from "@lista/shared";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { signIn } from "../../api/account";
import { asRequestError, type RequestErrorCode } from "../../api/client";
import { useFocusRequest } from "../../components/useFocus";
import { useSetSession } from "../../session/useSession";

type Field = "email" | "password";

/** `initialEmail`: wpisany już na SC-02 (3.3.7). */
export function useSignInForm(initialEmail = "") {
  const [values, setValues] = useState({ email: initialEmail, password: "" });
  const [missing, setMissing] = useState<Partial<Record<Field, true>>>({});
  const [formError, setFormError] = useState<RequestErrorCode | null>(null);
  const [focus, requestFocus] = useFocusRequest<Field | "alert">();
  const setSession = useSetSession();
  const mutation = useMutation({ mutationFn: signIn });

  const handleFailure = (error: unknown) => {
    const { code } = asRequestError(error);
    setFormError(code);
    // SC-01, stan „Error”: hasło wyczyszczone, e-mail zostaje.
    if (code === "invalid_credentials") setValues((current) => ({ ...current, password: "" }));
    requestFocus("alert");
  };

  const submit = () => {
    setFormError(null);
    const parsed = signInRequestSchema.safeParse(values);
    if (!parsed.success) {
      const fields = fieldErrors(parsed.error);
      setMissing({
        ...(fields.email && { email: true }),
        ...(fields.password && { password: true }),
      });
      requestFocus(fields.email ? "email" : "password");
      return;
    }
    setMissing({});
    mutation.mutate(parsed.data, {
      onSuccess: setSession,
      onError: handleFailure,
    });
  };

  const setField = (field: Field, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  return { values, setField, missing, formError, focus, submit, pending: mutation.isPending };
}
