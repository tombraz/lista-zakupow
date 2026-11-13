import { useRef } from "react";
import { useLocation } from "react-router";
import { AuthForm } from "../../components/AuthPage/AuthForm";
import { AuthPage } from "../../components/AuthPage/AuthPage";
import { Button } from "../../components/Button/Button";
import { InlineAlert } from "../../components/InlineAlert/InlineAlert";
import { TextField } from "../../components/TextField/TextField";
import { useFocusTargets } from "../../components/useFocus";
import { EntryLink } from "../../invitations/EntryLink";
import { emailOf, invitationOf } from "../../invitations/invitationContext";
import { formErrorText, messages } from "./messages";
import styles from "./PasswordResetScreen.module.css";
import { usePasswordResetRequest } from "./usePasswordResetRequest";
import { isNewLinkRequest } from "./useResetToken";

/** SC-03 krok 1: prośba o link resetu hasła (F-03). */
export function RequestLinkStep() {
  const state: unknown = useLocation().state;
  const invitation = invitationOf(state);
  const form = usePasswordResetRequest(emailOf(state));
  const emailRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useFocusTargets(form.focus, { email: emailRef }, isNewLinkRequest(state) ? titleRef : emailRef);

  return (
    <AuthPage title={messages.title} titleRef={titleRef}>
      <p className={styles.intro}>{messages.intro}</p>
      <InlineAlert tone="success">{form.sentTo !== null && messages.sent(form.sentTo)}</InlineAlert>
      {form.formError && <InlineAlert tone="error">{formErrorText(form.formError)}</InlineAlert>}
      <AuthForm onSubmit={form.submit}>
        <TextField
          ref={emailRef}
          label={messages.email.label}
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(event) => {
            form.setEmail(event.target.value);
          }}
          error={form.invalid && messages.email.invalid}
        />
        <Button writes={false} type="submit" loading={form.pending}>
          {messages.submit}
        </Button>
      </AuthForm>
      <EntryLink className={styles.back} to="/logowanie" email={form.email} invitation={invitation}>
        {messages.back}
      </EntryLink>
    </AuthPage>
  );
}
