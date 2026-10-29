import { Link, useNavigate } from "react-router";
import { signOut } from "../../api/account";
import { asRequestError } from "../../api/client";
import { AppBar } from "../../components/AppBar/AppBar";
import { Button } from "../../components/Button/Button";
import { InlineAlert } from "../../components/InlineAlert/InlineAlert";
import { useSession, useSetSession } from "../../session/useSession";
import styles from "./AccountScreen.module.css";
import { logoutErrorText, messages } from "./messages";
import { useGuardedMutation } from "../../api/useGuardedMutation";

/** SC-09 w zakresie T-004; zmiana imienia i usunięcie konta w E-02. */
export function AccountScreen() {
  const { data: me } = useSession();
  const setSession = useSetSession();
  const navigate = useNavigate();
  const logout = useGuardedMutation({
    mutationFn: signOut,
    onSuccess: () => {
      setSession(null);
      void navigate("/logowanie", { replace: true });
    },
  });

  return (
    <>
      <AppBar title={messages.title} back={{ to: "/listy", label: messages.back }} />
      <main className={styles.page}>
        {logout.error && (
          <InlineAlert tone="error">
            {logoutErrorText(asRequestError(logout.error).code)}
          </InlineAlert>
        )}
        <section className={styles.section} aria-labelledby="account-data">
          <h2 id="account-data">{messages.section}</h2>
          <dl className={styles.data}>
            <dt>{messages.email}</dt>
            <dd>{me?.email}</dd>
            <dt>{messages.name}</dt>
            <dd>{me?.name}</dd>
          </dl>
        </section>
        <Button
          variant="secondary"
          loading={logout.isPending}
          onClick={() => {
            logout.mutate();
          }}
        >
          {messages.logout}
        </Button>
        <Link to="/regulamin">{messages.legal}</Link>
      </main>
    </>
  );
}
