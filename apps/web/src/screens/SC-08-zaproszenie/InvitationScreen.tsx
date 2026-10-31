import type { InvitationPreview } from "@lista/shared";
import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import type { ApiRequestError } from "../../api/client";
import { Button } from "../../components/Button/Button";
import { InlineAlert } from "../../components/InlineAlert/InlineAlert";
import { shouldJoin, type EntryState } from "../../invitations/invitationContext";
import { useSession } from "../../session/useSession";
import { failureText, messages } from "./messages";
import styles from "./InvitationScreen.module.css";
import { useInvitation, type InvitationView } from "./useInvitation";

/** SC-08: strona docelowa linku zaproszenia (publiczna). */
export function InvitationScreen() {
  const { token = "" } = useParams();
  const { view, join } = useInvitation(token);
  const signedIn = Boolean(useSession().data);
  const title = view.kind === "invalid" ? messages.invalid.title : messages.title;
  useAutoJoin(view, signedIn, join);

  return (
    <main className={styles.page}>
      <title>{`${title} · Wspólna lista zakupów`}</title>
      <Heading key={view.kind} text={title} />
      {view.kind === "checking" && <p aria-busy="true">{messages.checking}</p>}
      {view.kind === "invalid" && <Invalid />}
      {view.kind === "failed" && (
        <InlineAlert tone="error">{failureText(view.error.code)}</InlineAlert>
      )}
      {view.kind === "invite" && (
        <Invite
          preview={view.preview}
          token={token}
          joinError={view.joinError}
          signedIn={signedIn}
          joining={join.isPending}
          onJoin={() => {
            join.mutate();
          }}
        />
      )}
    </main>
  );
}

/** Powrót po zalogowaniu (stan `join`): dołącz od razu, raz (SC-08, „Interactions”). */
function useAutoJoin(view: InvitationView, signedIn: boolean, join: { mutate: () => void }) {
  const location = useLocation();
  const started = useRef(false);
  const ready = view.kind === "invite" && signedIn && shouldJoin(location.state);
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    join.mutate();
  }, [ready, join]);
}

/** `h1` z fokusem przy każdej zmianie stanu: wynik sprawdzenia linku jest ogłaszany. */
function Heading({ text }: { text: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <h1 ref={ref} className={styles.title} tabIndex={-1}>
      {text}
    </h1>
  );
}

function Invalid() {
  return (
    <>
      <p>{messages.invalid.body}</p>
      <Link className={styles.primaryLink} to="/listy">
        {messages.invalid.cta}
      </Link>
    </>
  );
}

interface InviteProps {
  preview: InvitationPreview;
  token: string;
  joinError: ApiRequestError | null;
  signedIn: boolean;
  joining: boolean;
  onJoin: () => void;
}

function Invite({ preview, token, joinError, signedIn, joining, onJoin }: InviteProps) {
  const outcome = joinError && <JoinOutcome error={joinError} />;
  return (
    <>
      <p>{messages.body(preview.ownerName, preview.listName)}</p>
      {outcome}
      {!isFinal(joinError) &&
        (signedIn ? (
          <>
            <Button loading={joining} onClick={onJoin}>
              {messages.join}
            </Button>
            <Link className={styles.secondaryLink} to="/listy">
              {messages.later}
            </Link>
          </>
        ) : (
          <SignInChoice invitation={{ token, listName: preview.listName }} />
        ))}
    </>
  );
}

/** Limit, „już na liście”, „własna lista”: ponowne dołączenie nic nie zmieni. */
function isFinal(error: ApiRequestError | null): boolean {
  return (
    error !== null &&
    (error.code === "limit_reached" || error.code === "already_member" || error.code === "own_list")
  );
}

function JoinOutcome({ error }: { error: ApiRequestError }) {
  const { listId } = error.details;
  if ((error.code === "already_member" || error.code === "own_list") && listId) {
    return (
      <>
        <InlineAlert tone="info">
          {error.code === "own_list" ? messages.own : messages.already}
        </InlineAlert>
        <Link className={styles.primaryLink} to={`/listy/${listId}`}>
          {messages.open}
        </Link>
      </>
    );
  }
  if (error.code === "limit_reached")
    return <InlineAlert tone="error">{messages.limit}</InlineAlert>;
  return <InlineAlert tone="error">{failureText(error.code)}</InlineAlert>;
}

/**
 * Niezalogowany: SC-02 albo SC-01 z kontekstem zaproszenia. `replace`: adres z tokenem
 * nie zostaje w historii (TH-08), a po zalogowaniu SC-01 / SC-02 wraca tutaj.
 */
function SignInChoice({ invitation }: { invitation: EntryState["invitation"] }) {
  const navigate = useNavigate();
  const go = (path: string) => () => {
    const state: EntryState = { ...(invitation ? { invitation } : {}) };
    void navigate(path, { replace: true, state });
  };
  return (
    <>
      <Button onClick={go("/rejestracja")}>{messages.registerJoin}</Button>
      <Button variant="secondary" onClick={go("/logowanie")}>
        {messages.loginJoin}
      </Button>
    </>
  );
}
