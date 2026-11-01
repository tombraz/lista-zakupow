import {
  fieldErrors,
  passwordResetSchema,
  type FieldErrorCode,
  type PasswordReset,
} from "@lista/shared";
import { useState } from "react";
import { useNavigate } from "react-router";
import { resetPassword } from "../../api/account";
import { asRequestError, type RequestErrorCode } from "../../api/client";
import { useGuardedMutation } from "../../api/useGuardedMutation";
import { useFocusRequest } from "../../components/useFocus";
import type { EntryState } from "../../invitations/invitationContext";
import { useSetSession } from "../../session/useSession";

/** SC-03 krok 2: nowe hasło dla tokenu z linku. */
export function useNewPassword(token: string) {
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<FieldErrorCode | null>(null);
  const [failure, setFailure] = useState<RequestErrorCode | null>(null);
  const [focus, requestFocus] = useFocusRequest<"password">();
  const navigate = useNavigate();
  const setSession = useSetSession();

  const showPasswordError = (code: FieldErrorCode) => {
    setPasswordError(code);
    requestFocus("password");
  };

  const mutation = useGuardedMutation({
    mutationFn: (reset: PasswordReset) => resetPassword(reset),
    onSuccess: () => {
      // TH-10: reset usunął wszystkie sesje konta, także tę w tej przeglądarce.
      setSession(null);
      const state: EntryState = { passwordChanged: true };
      // `replace`: strona z tokenem nie zostaje w historii.
      void navigate("/logowanie", { replace: true, state });
    },
    onError: (error) => {
      const { code, fields } = asRequestError(error);
      if (fields.newPassword) showPasswordError(fields.newPassword);
      else setFailure(code);
    },
  });

  const submit = () => {
    setFailure(null);
    const parsed = passwordResetSchema.safeParse({ token, newPassword: password });
    if (parsed.success) {
      setPasswordError(null);
      mutation.mutate(parsed.data);
      return;
    }
    const fieldError = fieldErrors(parsed.error).newPassword;
    if (fieldError) showPasswordError(fieldError);
    // Tylko token niepoprawny (np. pusty w adresie): link nie działa.
    else setFailure("invalid_token");
  };

  return {
    password,
    setPassword,
    passwordError,
    focus,
    submit,
    pending: mutation.isPending,
    linkInvalid: failure === "invalid_token",
    failure: failure === "invalid_token" ? null : failure,
  };
}
