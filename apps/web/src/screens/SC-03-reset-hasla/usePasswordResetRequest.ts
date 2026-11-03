import { passwordResetRequestSchema } from "@lista/shared";
import { useState } from "react";
import { requestPasswordReset } from "../../api/account";
import { asRequestError, type RequestErrorCode } from "../../api/client";
import { useGuardedMutation } from "../../api/useGuardedMutation";
import { useFocusRequest } from "../../components/useFocus";

/** SC-03 krok 1. `initialEmail`: wpisany już na SC-01 / SC-02 (3.3.7). */
export function usePasswordResetRequest(initialEmail = "") {
  const [email, setEmail] = useState(initialEmail);
  const [invalid, setInvalid] = useState(false);
  // Adres, dla którego wysłano prośbę — pole mogło się zmienić w trakcie.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<RequestErrorCode | null>(null);
  const [focus, requestFocus] = useFocusRequest<"email">();

  const mutation = useGuardedMutation({
    mutationFn: requestPasswordReset,
    onSuccess: (_data, request) => {
      setFormError(null);
      setSentTo(request.email);
    },
    onError: (error) => {
      setSentTo(null);
      setFormError(asRequestError(error).code);
    },
  });

  const submit = () => {
    const parsed = passwordResetRequestSchema.safeParse({ email });
    setInvalid(!parsed.success);
    if (!parsed.success) {
      requestFocus("email");
      return;
    }
    mutation.mutate(parsed.data);
  };

  return {
    email,
    setEmail,
    invalid,
    sentTo,
    formError,
    focus,
    submit,
    pending: mutation.isPending,
  };
}
