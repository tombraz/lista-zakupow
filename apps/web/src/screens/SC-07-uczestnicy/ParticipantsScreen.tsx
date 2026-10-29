import { BUSINESS_LIMITS, type Invitation, type ListDetails } from "@lista/shared";
import { useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { AppBar } from "../../components/AppBar/AppBar";
import { Avatar } from "../../components/Avatar/Avatar";
import { Button } from "../../components/Button/Button";
import { InlineAlert } from "../../components/InlineAlert/InlineAlert";
import { InviteLinkBox } from "../../components/InviteLinkBox/InviteLinkBox";
import { LoadError } from "../../components/LoadError/LoadError";
import { Skeleton } from "../../components/Skeleton/Skeleton";
import { Toast, useToast } from "../../components/Toast/Toast";
import { useList } from "../../lists/useList";
import { useLiveList } from "../../live/useLiveList";
import { createErrorText, messages, revokeErrorText } from "./messages";
import styles from "./ParticipantsScreen.module.css";
import { useInvitationChanges, useInvitations } from "./useInvitations";

/** SC-07: uczestnicy i (właściciel) linki zaproszeń. Sekcja uczestników w pełni — E-02. */
export function ParticipantsScreen() {
  const { listId = "" } = useParams();
  const page = useParticipantsPage(listId);

  return (
    <>
      <AppBar title={messages.title} back={{ to: `/listy/${listId}`, label: messages.back }} />
      <main className={styles.page} aria-busy={page.status === "loading" || undefined}>
        {page.status === "loading" && <Skeleton rows={3} variant="row" />}
        {page.status === "failed" && <LoadError text={messages.loadError} onRetry={page.retry} />}
        {page.status === "noAccess" && (
          <>
            <p>{messages.noAccess}</p>
            <Link to="/listy">{messages.backToLists}</Link>
          </>
        )}
        {page.status === "ready" && <Members list={page.list} />}
        {page.status === "ready" && page.links && (
          <Invitations list={page.list} links={page.links} />
        )}
      </main>
    </>
  );
}

type ParticipantsPage =
  | { status: "loading" | "noAccess" }
  | { status: "failed"; retry: () => void }
  | { status: "ready"; list: ListDetails; links: Invitation[] | undefined };

/** Lista i (właściciel) jej aktywne linki; uczestnik linków nie pobiera (403, TH-02). */
function useParticipantsPage(listId: string): ParticipantsPage {
  const list = useList(listId);
  useLiveList(listId);
  const isOwner = list.data?.role === "owner";
  const invitations = useInvitations(listId, isOwner);
  // MC-01: cudza lista jak na SC-06 — bez nazwy i treści.
  if (list.noAccess) return { status: "noAccess" };
  if (list.isError || invitations.isError) {
    const retry = () => {
      void list.refetch();
      if (isOwner) void invitations.refetch();
    };
    return { status: "failed", retry };
  }
  if (!list.data || (isOwner && !invitations.data)) return { status: "loading" };
  return { status: "ready", list: list.data, links: invitations.data };
}

/** W E-01 tylko wiersz właściciela; lista uczestników z e-mailami i usuwaniem — E-02. */
function Members({ list }: { list: ListDetails }) {
  const isOwner = list.role === "owner";
  return (
    <section className={styles.section} aria-labelledby="members-heading">
      <h2 id="members-heading" className={styles.heading}>
        {messages.members(list.members.length)}
      </h2>
      <ul className={styles.people}>
        <li className={styles.person}>
          <Avatar person={list.owner} index={0} />
          <span>
            <span className={styles.name}>{list.owner.name}</span>
            <span className={styles.role}>
              {isOwner ? `${messages.owner} · ${messages.you}` : messages.owner}
            </span>
          </span>
        </li>
      </ul>
      {isOwner && list.members.length === 0 && <p className={styles.empty}>{messages.empty}</p>}
    </section>
  );
}

function Invitations({ list, links }: { list: ListDetails; links: Invitation[] }) {
  const createRef = useRef<HTMLButtonElement>(null);
  const [focusCopyOf, setFocusCopyOf] = useState<string>();
  const [announcement, setAnnouncement] = useState("");
  const toast = useToast();
  const changes = useInvitationChanges(list.id, {
    onCreated: setFocusCopyOf,
    onRevoked: () => {
      setAnnouncement(messages.revoked);
      createRef.current?.focus();
    },
  });
  const full = list.members.length >= BUSINESS_LIMITS.participantsPerList;
  const { failure } = changes;

  const copy = async (url: string) => {
    if (!(await copyToClipboard(url))) return false;
    toast.show(messages.copied);
    return true;
  };

  return (
    <section className={styles.section} aria-labelledby="invites-heading">
      <h2 id="invites-heading" className={styles.heading}>
        {messages.invites}
      </h2>
      {full && <InlineAlert tone="warning">{messages.limit}</InlineAlert>}
      {failure && (
        <InlineAlert tone="error">
          {failure.action === "create"
            ? createErrorText(failure.code)
            : revokeErrorText(failure.code)}
        </InlineAlert>
      )}
      {links.map((link) => (
        <InviteLinkBox
          key={link.id}
          description={messages.validUntil(link.expiresAt)}
          url={link.url}
          copyLabel={messages.copy}
          revokeLabel={messages.revoke}
          manualCopyText={messages.copyManually}
          focusCopy={focusCopyOf === link.id}
          onCopy={copy}
          revoking={changes.revoke.isPending && changes.revoke.variables === link.id}
          onRevoke={() => {
            setAnnouncement("");
            changes.revoke.mutate(link.id);
          }}
        />
      ))}
      <Button
        ref={createRef}
        disabled={full}
        loading={changes.create.isPending}
        onClick={() => {
          changes.create.mutate();
        }}
      >
        {messages.create}
      </Button>
      <p className={styles.hint}>{messages.hint}</p>
      <p className={styles.visuallyHidden} role="status">
        {announcement}
      </p>
      <Toast text={toast.text} />
    </section>
  );
}

/** `false`, gdy przeglądarka nie daje schowka (brak API, brak uprawnień). */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // W niezabezpieczonym kontekście `navigator.clipboard` nie istnieje.
    const clipboard = (navigator as Partial<Navigator>).clipboard;
    if (!clipboard) return false;
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
