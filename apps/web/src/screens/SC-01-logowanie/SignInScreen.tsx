import { useRef } from "react";
import { useLocation } from "react-router";
import { AuthPage } from "../../components/AuthPage/AuthPage";
import { Button } from "../../components/Button/Button";
import { InlineAlert } from "../../components/InlineAlert/InlineAlert";
import { PasswordField } from "../../components/PasswordField/PasswordField";
import { TextField } from "../../components/TextField/TextField";
import { useFocusTargets } from "../../components/useFocus";
import { EntryLink } from "../../invitations/EntryLink";
import { emailOf, invitationOf } from "../../invitations/invitationContext";
import { formErrorText, messages } from "./messages";
import styles from "./SignInScreen.module.css";
import { useSignInForm } from "./useSignInForm";

export function SignInScreen() {
  const state: unknown = useLocation().state;
  const invitation = invitationOf(state);
  const form = useSignInForm(emailOf(state));
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  useFocusTargets(
    form.focus,
    { email: emailRef, password: passwordRef, alert: alertRef },
    emailRef,
  );

  return (
    <AuthPage title={messages.title}>
      {invitation && (
        <InlineAlert tone="info">{messages.invitation(invitation.listName)}</InlineAlert>
      )}
      {form.formError && (
        <InlineAlert tone="error" ref={alertRef}>
          {formErrorText(form.formError)}
        </InlineAlert>
      )}
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          form.submit();
        }}
      >
        <TextField
          ref={emailRef}
          label={messages.email.label}
          type="email"
          autoComplete="email"
          value={form.values.email}
          onChange={(event) => {
            form.setField("email", event.target.value);
          }}
          error={form.missing.email && messages.email.required}
        />
        <PasswordField
          ref={passwordRef}
          label={messages.password.label}
          autoComplete="current-password"
          value={form.values.password}
          onChange={(event) => {
            form.setField("password", event.target.value);
          }}
          error={form.missing.password && messages.password.required}
        />
        <Button type="submit" loading={form.pending}>
          {messages.submit}
        </Button>
      </form>
      <div className={styles.register}>
        <p>{messages.noAccount}</p>
        <EntryLink
          className={styles.secondary}
          to="/rejestracja"
          email={form.values.email}
          invitation={invitation}
        >
          {messages.register}
        </EntryLink>
      </div>
    </AuthPage>
  );
}
