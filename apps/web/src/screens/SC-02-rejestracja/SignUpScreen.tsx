import { NAME_MAX_LENGTH } from "@lista/shared";
import { useRef } from "react";
import { Link } from "react-router";
import { AuthPage } from "../../components/AuthPage/AuthPage";
import { Button } from "../../components/Button/Button";
import { ConsentCheckbox } from "../../components/ConsentCheckbox/ConsentCheckbox";
import { InlineAlert } from "../../components/InlineAlert/InlineAlert";
import { PasswordField } from "../../components/PasswordField/PasswordField";
import { TextField } from "../../components/TextField/TextField";
import { useFocusTargets } from "../../components/useFocus";
import { ErrorSummary } from "./ErrorSummary";
import { fieldMessages, formErrorText, messages, type SignUpField } from "./messages";
import styles from "./SignUpScreen.module.css";
import { useSignUpForm, type FieldErrors } from "./useSignUpForm";

export const FIELD_IDS: Record<SignUpField, string> = {
  name: "sign-up-name",
  email: "sign-up-email",
  password: "sign-up-password",
  termsAccepted: "sign-up-terms",
  ageConfirmed: "sign-up-age",
};

function errorText(errors: FieldErrors, field: SignUpField): string | undefined {
  const code = errors[field];
  return code && code !== "email_taken" ? fieldMessages[field][code] : undefined;
}

export function SignUpScreen() {
  const form = useSignUpForm();
  const { values, errors, setField } = form;
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  useFocusTargets(form.focus, { summary: summaryRef, email: emailRef, alert: alertRef }, nameRef);

  return (
    <AuthPage title={messages.title} legalInNewTab>
      {form.formError && (
        <InlineAlert tone="error" ref={alertRef}>
          {formErrorText(form.formError)}
        </InlineAlert>
      )}
      {form.showSummary && (
        <ErrorSummary
          ref={summaryRef}
          errors={errors}
          text={(field) => errorText(errors, field)}
          ids={FIELD_IDS}
        />
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
          ref={nameRef}
          id={FIELD_IDS.name}
          label={messages.name.label}
          hint={messages.name.hint}
          autoComplete="given-name"
          maxChars={NAME_MAX_LENGTH}
          value={values.name}
          onChange={(event) => {
            setField("name", event.target.value);
          }}
          error={errorText(errors, "name")}
        />
        <TextField
          ref={emailRef}
          id={FIELD_IDS.email}
          label={messages.email.label}
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(event) => {
            setField("email", event.target.value);
          }}
          error={errors.email === "email_taken" ? <EmailTaken /> : errorText(errors, "email")}
        />
        <PasswordField
          id={FIELD_IDS.password}
          label={messages.password.label}
          hint={messages.password.hint}
          autoComplete="new-password"
          value={values.password}
          onChange={(event) => {
            setField("password", event.target.value);
          }}
          error={errorText(errors, "password")}
        />
        <Consents values={values} errors={errors} setField={setField} />
        <Button type="submit" loading={form.pending}>
          {messages.submit}
        </Button>
      </form>
      <p className={styles.switch}>
        {messages.haveAccount} <Link to="/logowanie">{messages.signIn}</Link>
      </p>
    </AuthPage>
  );
}

function EmailTaken() {
  const text = messages.emailTaken;
  return (
    <>
      {text.before} <Link to="/logowanie">{text.signIn}</Link> {text.or}{" "}
      <Link to="/reset-hasla">{text.reset}</Link>.
    </>
  );
}

type ConsentsProps = Pick<ReturnType<typeof useSignUpForm>, "values" | "errors" | "setField">;

function Consents({ values, errors, setField }: ConsentsProps) {
  const consent = messages.consent;
  return (
    <>
      <ConsentCheckbox
        id={FIELD_IDS.termsAccepted}
        checked={values.termsAccepted}
        onChange={(event) => {
          setField("termsAccepted", event.target.checked);
        }}
        error={errorText(errors, "termsAccepted")}
        label={
          <>
            {consent.accept}{" "}
            <Link to="/regulamin" target="_blank" rel="noopener">
              {consent.terms}
            </Link>{" "}
            {consent.and}{" "}
            <Link to="/regulamin#polityka-prywatnosci" target="_blank" rel="noopener">
              {consent.privacy}
            </Link>
            .
          </>
        }
      />
      <ConsentCheckbox
        id={FIELD_IDS.ageConfirmed}
        checked={values.ageConfirmed}
        onChange={(event) => {
          setField("ageConfirmed", event.target.checked);
        }}
        error={errorText(errors, "ageConfirmed")}
        label={messages.age}
      />
    </>
  );
}
