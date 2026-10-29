import {
  fieldErrors,
  signUpRequestSchema,
  type FieldErrorCode,
  type SignUpResponse,
} from "@lista/shared";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { signUp } from "../../api/account";
import { asRequestError, type RequestErrorCode } from "../../api/client";
import { useFocusRequest } from "../../components/useFocus";
import { emailOf, invitationOf, type EntryState } from "../../invitations/invitationContext";
import { useSetSession } from "../../session/useSession";
import type { SignUpField } from "./messages";
import { useGuardedMutation } from "../../api/useGuardedMutation";

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

/**
 * F-01, F-12: rejestracja z linku już dołączyła — `PublicOnly` przejdzie od razu na listę;
 * inaczej na SC-08, który pokaże, czemu się nie udało. `flushSync`: `joinedListId` musi być w
 * stanie trasy, zanim strażnik zobaczy sesję — inaczej wyśle drugi `accept` (T-019).
 */
function useSignedUp() {
  const location = useLocation();
  const navigate = useNavigate();
  const setSession = useSetSession();
  return async ({ user, invitation: joined }: SignUpResponse) => {
    if (joined && "listId" in joined) {
      const previous = (location.state ?? {}) as EntryState;
      const state: EntryState = { ...previous, joinedListId: joined.listId };
      await navigate(location.pathname, { replace: true, state, flushSync: true });
    }
    setSession(user);
  };
}

export function useSignUpForm() {
  const state: unknown = useLocation().state;
  const invitation = invitationOf(state);
  const [values, setValues] = useState({ ...EMPTY, email: emailOf(state) });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showSummary, setShowSummary] = useState(false);
  const [formError, setFormError] = useState<RequestErrorCode | null>(null);
  // SC-02, „Accessibility”: po błędach fokus na podsumowaniu, polu e-mail albo komunikacie.
  const [focus, requestFocus] = useFocusRequest<"summary" | "email" | "alert">();
  const signedUp = useSignedUp();
  const mutation = useGuardedMutation({ mutationFn: signUp });

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
    const account = invitation
      ? { ...parsed.data, invitationToken: invitation.token }
      : parsed.data;
    mutation.mutate(account, {
      onSuccess: (response) => void signedUp(response),
      onError: handleFailure,
    });
  };

  const setField = <K extends keyof SignUpValues>(field: K, value: SignUpValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  return {
    invitation,
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
