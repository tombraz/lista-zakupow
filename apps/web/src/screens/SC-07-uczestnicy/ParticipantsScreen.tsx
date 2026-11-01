import {
  BUSINESS_LIMITS,
  type Invitation,
  type ListDetails,
  type ListMembers,
  type Participant,
} from "@lista/shared";
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
import { useLimitFocus } from "../../components/useFocus";
import { useList } from "../../lists/useList";
import { useMembers } from "../../lists/useMembers";
import { useSession } from "../../session/useSession";
import { useLiveList } from "../../live/useLiveList";
import { createErrorText, messages, revokeErrorText } from "./messages";
import styles from "./ParticipantsScreen.module.css";
import { useInvitationChanges, useInvitations } from "./useInvitations";

/** SC-07: kto ma dostęp do listy i (właściciel) linki zaproszeń. */
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
        {page.status === "ready" && <Members list={page.list} members={page.members} />}
        {page.status === "ready" && page.links && (
          <Invitations
            listId={page.list.id}
            participantCount={page.members.participants.length}
            links={page.links}
          />
        )}
      </main>
    </>
  );
}

type ParticipantsPage =
  | { status: "loading" | "noAccess" }
  | { status: "failed"; retry: () => void }
  | {
      status: "ready";
      list: ListDetails;
      members: ListMembers;
      links: Invitation[] | undefined;
    };

/** Lista, jej uczestnicy i (właściciel) aktywne linki; uczestnik linków nie pobiera (403, TH-02). */
function useParticipantsPage(listId: string): ParticipantsPage {
  const list = useList(listId);
  const members = useMembers(listId);
  useLiveList(listId);
  const isOwner = list.data?.role === "owner";
  const invitations = useInvitations(listId, isOwner);
  const { retrying, retry } = useRetry([
    list.refetch,
    members.refetch,
    ...(isOwner ? [invitations.refetch] : []),
  ]);
  // MC-01: cudza lista jak na SC-06 — bez nazwy i treści.
  if (list.noAccess) return { status: "noAccess" };
  if (retrying || [list, members, invitations].some((query) => query.isError)) {
    return { status: "failed", retry };
  }
  if (!list.data || !members.data || (isOwner && !invitations.data)) return { status: "loading" };
  return { status: "ready", list: list.data, members: members.data, links: invitations.data };
}

/**
 * „Spróbuj ponownie”: zapytanie bez danych wraca przy ponowieniu do stanu „pending”, więc
 * `retrying` trzyma komunikat błędu do końca ponowienia — fokus nie spada z przycisku na `body`
 * (WCAG 2.4.3).
 */
function useRetry(refetches: (() => Promise<unknown>)[]) {
  const [retrying, setRetrying] = useState(false);
  const retry = () => {
    setRetrying(true);
    void Promise.allSettled(refetches.map((refetch) => refetch())).then(() => {
      setRetrying(false);
    });
  };
  return { retrying, retry };
}

/** F-13: właściciel i uczestnicy w kolejności dołączenia; e-mail tylko w widoku właściciela. */
function Members({ list, members }: { list: ListDetails; members: ListMembers }) {
  const isOwner = list.role === "owner";
  const me = useSession().data?.id;
  const { owner, participants } = members;
  return (
    <section className={styles.section} aria-labelledby="members-heading">
      <h2 id="members-heading" className={styles.heading}>
        {messages.members(participants.length)}
      </h2>
      <ul className={styles.people}>
        <PersonRow
          person={owner}
          index={0}
          detail={isOwner ? `${messages.owner} · ${messages.you}` : messages.owner}
        />
        {participants.map((person, index) => (
          <PersonRow
            key={person.id}
            person={person}
            index={index + 1}
            detail={person.id === me ? messages.you : person.email}
          />
        ))}
      </ul>
      {isOwner && participants.length === 0 && <p className={styles.empty}>{messages.empty}</p>}
    </section>
  );
}

/** Wiersz osoby: awatar, imię, pod spodem rola („właściciel”, „Ty”) albo e-mail. */
function PersonRow({
  person,
  index,
  detail,
}: {
  person: Participant;
  index: number;
  detail: string | undefined;
}) {
  return (
    <li className={styles.person}>
      <Avatar person={person} index={index} />
      <span className={styles.who}>
        <span className={styles.name}>{person.name}</span>
        {detail && <span className={styles.role}>{detail}</span>}
      </span>
    </li>
  );
}

function Invitations({
  listId,
  participantCount,
  links,
}: {
  listId: string;
  participantCount: number;
  links: Invitation[];
}) {
  const createRef = useRef<HTMLButtonElement>(null);
  const [focusCopyOf, setFocusCopyOf] = useState<string>();
  const [announcement, setAnnouncement] = useState("");
  const toast = useToast();
  const full = participantCount >= BUSINESS_LIMITS.participantsPerList;
  // Pełna lista wyłącza „Utwórz link”, więc fokus idzie na ostrzeżenie (T-025).
  const limitRef = useLimitFocus(full, createRef);
  const changes = useInvitationChanges(listId, {
    onCreated: setFocusCopyOf,
    onRevoked: () => {
      setAnnouncement(messages.revoked);
      (full ? limitRef : createRef).current?.focus();
    },
  });
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
      {full && (
        <InlineAlert ref={limitRef} tone="warning">
          {messages.limit}
        </InlineAlert>
      )}
      {failure && <InvitationFailure failure={failure} />}
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
          revoking={changes.revoke.isLocked(link.id)}
          onRevoke={() => {
            setAnnouncement("");
            changes.revoke.mutate(link.id);
          }}
        />
      ))}
      <Button
        ref={createRef}
        writes
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

/** Błąd utworzenia albo unieważnienia linku. */
function InvitationFailure({
  failure,
}: {
  failure: NonNullable<ReturnType<typeof useInvitationChanges>["failure"]>;
}) {
  return (
    <InlineAlert tone="error">
      {failure.action === "create" ? createErrorText(failure.code) : revokeErrorText(failure.code)}
    </InlineAlert>
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
