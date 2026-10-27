import { fieldErrors, signUpRequestSchema, type FieldErrorCode } from "@lista/shared";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { signUp } from "../../api/account";
import { asRequestError, type RequestErrorCode } from "../../api/client";
import { useFocusRequest } from "../../components/useFocus";
import { useSetSession } from "../../session/useSession";
import type { SignUpField } from "./messages";

export interface SignUpValues {
  name: string;
  email: string;
  password: string;
  termsAccepted: boolean;
  ageConfirmed: boolean;
}

export type FieldErrors = Partial<Record<SignUpField, FieldErrorCode | "email_taken">>;

const EMPTY: SignUpValues = {
  name: "",
  email: "",
  password: "",
  termsAccepted: false,
  ageConfirmed: false,
};

export function useSignUpForm() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showSummary, setShowSummary] = useState(false);
  const [formError, setFormError] = useState<RequestErrorCode | null>(null);
  // SC-02, „Accessibility”: po błędach fokus na podsumowaniu, polu e-mail albo komunikacie.
  const [focus, requestFocus] = useFocusRequest<"summary" | "email" | "alert">();
  const setSession = useSetSession();
  const mutation = useMutation({ mutationFn: signUp });

  const showFieldErrors = (fields: FieldErrors) => {
    setErrors(fields);
    setShowSummary(true);
    requestFocus("summary");
  };

  const handleFailure = (error: unknown) => {
    const failure = asRequestError(error);
    if (failure.code === "validation_failed") {
      showFieldErrors(failure.fields);
    } else if (failure.code === "email_taken") {
      setErrors({ email: "email_taken" });
      requestFocus("email");
    } else {
      setFormError(failure.code);
      requestFocus("alert");
    }
  };

  const submit = () => {
    setErrors({});
    setShowSummary(false);
    setFormError(null);
    const parsed = signUpRequestSchema.safeParse(values);
    if (!parsed.success) {
      showFieldErrors(fieldErrors(parsed.error));
      return;
    }
    mutation.mutate(parsed.data, {
      onSuccess: setSession,
      onError: handleFailure,
    });
  };

  const setField = <K extends keyof SignUpValues>(field: K, value: SignUpValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  return {
    values,
    setField,
    errors,
    showSummary,
    formError,
    focus,
    submit,
    pending: mutation.isPending,
  };
}
