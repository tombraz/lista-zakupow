import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { AuthForm } from "../../components/AuthPage/AuthForm";
import { AuthPage } from "../../components/AuthPage/AuthPage";
import { Button } from "../../components/Button/Button";
import { InlineAlert } from "../../components/InlineAlert/InlineAlert";
import { PasswordField } from "../../components/PasswordField/PasswordField";
import { useFocusTargets } from "../../components/useFocus";
import { messages, passwordErrorText, saveErrorText } from "./messages";
import { useNewPassword } from "./useNewPassword";
import type { ResetState } from "./useResetToken";

/** SC-03 krok 2: nowe hasło z linku w mailu (F-03). */
export function NewPasswordStep({ token }: { token: string }) {
  const form = useNewPassword(token);
  const passwordRef = useRef<HTMLInputElement>(null);
  useFocusTargets(form.focus, { password: passwordRef }, passwordRef);

  if (form.linkInvalid) return <InvalidLink />;
  return (
    <AuthPage title={messages.step2.title}>
      {form.failure && <InlineAlert tone="error">{saveErrorText(form.failure)}</InlineAlert>}
      <AuthForm onSubmit={form.submit}>
        <PasswordField
          ref={passwordRef}
          label={messages.step2.password.label}
          hint={messages.step2.password.hint}
          autoComplete="new-password"
          value={form.password}
          onChange={(event) => {
            form.setPassword(event.target.value);
          }}
          error={form.passwordError && passwordErrorText(form.passwordError)}
        />
        <Button writes={false} type="submit" loading={form.pending}>
          {messages.step2.submit}
        </Button>
      </AuthForm>
    </AuthPage>
  );
}

/** Stan „Error — link nieważny”: zamiast formularza komunikat i droga do kroku 1. */
function InvalidLink() {
  const navigate = useNavigate();
  const alertRef = useRef<HTMLDivElement>(null);
  // Formularz z fokusem znika; fokus na komunikat, nie na `body` (WCAG 2.4.3).
  useEffect(() => {
    alertRef.current?.focus();
  }, []);

  return (
    <AuthPage title={messages.step2.title}>
      <InlineAlert tone="error" ref={alertRef}>
        {messages.step2.invalid}
      </InlineAlert>
      <Button
        writes={false}
        onClick={() => {
          const state: ResetState = { newLink: true };
          void navigate("/reset-hasla", { replace: true, state });
        }}
      >
        {messages.step2.resend}
      </Button>
    </AuthPage>
  );
}
