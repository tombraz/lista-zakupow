import type { ListDetails, ListMembers, Participant } from "@lista/shared";
import { useEffect, useRef, useState, type ReactNode, type Ref, type RefObject } from "react";
import { Avatar } from "../../components/Avatar/Avatar";
import { Button } from "../../components/Button/Button";
import { ConfirmDialog } from "../../components/ConfirmDialog/ConfirmDialog";
import { useSession } from "../../session/useSession";
import { messages } from "./messages";
import styles from "./ParticipantsScreen.module.css";
import { useRemovalFocus } from "./useRemovalFocus";
import { useRemoveParticipant, type ParticipantRemoval } from "./useRemoveParticipant";

/**
 * F-13: właściciel i uczestnicy w kolejności dołączenia; e-mail tylko w widoku właściciela.
 * Właściciel usuwa uczestnika po potwierdzeniu (SC-07 „Interactions”).
 */
export function Members({ list, members }: { list: ListDetails; members: ListMembers }) {
  const isOwner = list.role === "owner";
  const me = useSession().data?.id;
  const { owner, participants } = members;
  const { headingRef, register, remember, focusAfter } = useRemovalFocus(participants);
  const trigger = useRef<HTMLElement | null>(null);
  const [confirming, setConfirming] = useState<Participant | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const removal = useRemoveParticipant(list.id, (person, remaining) => {
    setAnnouncement(messages.members(remaining));
    // Okno innej osoby zostaje otwarte z fokusem w środku; fokus przeniesie jej usunięcie.
    if (confirming && confirming.id !== person.id) return;
    setConfirming(null);
    focusAfter(person);
  });
  const ask = (person: Participant, button: HTMLElement) => {
    trigger.current = button;
    remember(person);
    setAnnouncement("");
    setConfirming(person);
  };
  // Osoba z otwartego okna zniknęła sama (odeszła, usunięta w innej karcie): okno się zamyka.
  // W efekcie, nie w renderze: zamknięcie okna i przeniesienie fokusu to skutki uboczne, które
  // podwójny render StrictMode by powtórzył (web.md „Pułapki”, T-097).
  const vanished =
    confirming && !participants.some(({ id }) => id === confirming.id) ? confirming : null;
  useEffect(() => {
    if (!vanished) return;
    // Zmiana z zewnątrz (dane na żywo), nie zdarzenie użytkownika — nie ma handlera, w którym zamknąć okno.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConfirming(null);
    focusAfter(vanished);
  }, [vanished, focusAfter]);

  return (
    <section className={styles.section} aria-labelledby="members-heading">
      <h2 id="members-heading" ref={headingRef} className={styles.heading} tabIndex={-1}>
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
          >
            {isOwner && (
              <RemoveButton
                person={person}
                buttonRef={register(person.id)}
                removing={removal.isRemoving(person)}
                onClick={ask}
              />
            )}
          </PersonRow>
        ))}
      </ul>
      {isOwner && participants.length === 0 && <p className={styles.empty}>{messages.empty}</p>}
      <p className={styles.visuallyHidden} role="status">
        {announcement}
      </p>
      {confirming && (
        <RemoveDialog
          person={confirming}
          removal={removal}
          onConfirm={() => {
            remember(confirming);
          }}
          onClose={() => {
            setConfirming(null);
          }}
          returnFocus={trigger}
        />
      )}
    </section>
  );
}

/** „Usuń” przy uczestniku; nazwa dostępna z imieniem (SC-07 „Accessibility”). */
function RemoveButton(props: {
  person: Participant;
  buttonRef: Ref<HTMLButtonElement>;
  removing: boolean;
  onClick: (person: Participant, button: HTMLElement) => void;
}) {
  const { person, buttonRef, removing, onClick } = props;
  return (
    <Button
      ref={buttonRef}
      variant="danger"
      writes
      loading={removing}
      aria-label={messages.remove.label(person.name)}
      onClick={(event) => {
        onClick(person, event.currentTarget);
      }}
    >
      {messages.remove.action}
    </Button>
  );
}

/** „Usunąć {imię} z listy?”; błąd zapisu w oknie, które zostaje otwarte (T-058 AC4). */
function RemoveDialog(props: {
  person: Participant;
  removal: ParticipantRemoval;
  onConfirm: () => void;
  onClose: () => void;
  returnFocus: RefObject<HTMLElement | null>;
}) {
  const { person, removal } = props;
  return (
    <ConfirmDialog
      question={messages.remove.question(person.name)}
      consequence={messages.remove.consequence}
      confirmLabel={messages.remove.action}
      cancelLabel={messages.cancel}
      pending={removal.isRemoving(person)}
      error={removal.error(person)}
      onConfirm={() => {
        props.onConfirm();
        removal.remove(person);
      }}
      onCancel={props.onClose}
      returnFocus={props.returnFocus}
    />
  );
}

/** Wiersz osoby: awatar, imię, pod spodem rola („właściciel”, „Ty”) albo e-mail. */
function PersonRow({
  person,
  index,
  detail,
  children,
}: {
  person: Participant;
  index: number;
  detail: string | undefined;
  children?: ReactNode;
}) {
  return (
    <li className={styles.person}>
      <Avatar person={person} index={index} />
      <span className={styles.who}>
        <span className={styles.name}>{person.name}</span>
        {detail && <span className={styles.role}>{detail}</span>}
      </span>
      {children}
    </li>
  );
}
