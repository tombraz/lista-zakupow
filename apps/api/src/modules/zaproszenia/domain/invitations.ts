import {
  BUSINESS_LIMITS,
  INVITATION_VALIDITY_DAYS,
  RATE_LIMITS,
  type InvitationPreview,
} from "@lista/shared";
import type { Clock } from "../../../clock";
import { DomainError } from "../../../domain-error";
import { isUuid } from "../../../ids";
import { invitationToken, type RandomBytes } from "./token";

const DAY_MS = 24 * 60 * 60 * 1000;

// TH-06: token to 43 znaki base64url; inny tekst nie trafia do bazy.
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

/** Link zaproszenia, który widzi właściciel listy (SC-07). */
export interface StoredInvitation {
  id: string;
  token: string;
  expiresAt: Date;
}

export interface NewInvitation {
  listId: string;
  token: string;
  createdAt: Date;
  expiresAt: Date;
}

/** Repozytorium zaproszeń, którego potrzebuje domena; implementacja w `infra`. */
export interface InvitationsRepository {
  /** Nowy link albo `null`, gdy lista ma już `window.max` linków utworzonych od `window.since`. */
  insertWithinRate(
    invitation: NewInvitation,
    window: { since: Date; max: number },
  ): Promise<StoredInvitation | null>;
  /** Nieużyte, nieunieważnione i niewygasłe w chwili `now`, od najnowszego. */
  activeOf(listId: string, now: Date): Promise<StoredInvitation[]>;
  /** Unieważnia aktywny link listy; `false` — nie ma takiego aktywnego linku. */
  revoke(listId: string, invitationId: string, now: Date): Promise<boolean>;
  /** Lista ważnego linku albo `null` (użyty, unieważniony, wygasły, nieznany). */
  activeListOf(token: string, now: Date): Promise<string | null>;
  /**
   * Oznacza ważny link jako użyty i dopisuje uczestnika w jednej transakcji; błąd dopisania
   * wycofuje oznaczenie (link zostaje ważny). Zwraca listę albo `null` dla nieważnego linku.
   */
  accept(token: string, userId: string, now: Date): Promise<string | null>;
}

/** To, czego domena zaproszeń potrzebuje od modułu `listy` (implementacja: `Lists`). */
export interface InvitedLists {
  /** Nazwa listy i imię właściciela; `null` — lista nie istnieje. */
  invitationTarget(listId: string): Promise<InvitationPreview | null>;
  participantCount(listId: string): Promise<number>;
}

export interface InvitationsContext {
  repository: InvitationsRepository;
  lists: InvitedLists;
  clock: Clock;
  random: RandomBytes;
}

/** F-11: dostęp właściciela sprawdzony wcześniej (`requireListAccess(…, "owner")`). */
export async function createInvitation(
  { repository, lists, clock, random }: InvitationsContext,
  listId: string,
): Promise<StoredInvitation> {
  // F-12: link, którym nikt nie mógłby dołączyć, nie powstaje.
  if ((await lists.participantCount(listId)) >= BUSINESS_LIMITS.participantsPerList) {
    throw new DomainError("limit_reached", {
      limit: "participants",
      security: { event: "limit_reached", ids: { listId } },
    });
  }
  const createdAt = clock.now();
  const expiresAt = new Date(createdAt.getTime() + INVITATION_VALIDITY_DAYS * DAY_MS);
  const { windowSeconds, max } = RATE_LIMITS.invitationsCreatedPerList;
  const window = { since: new Date(createdAt.getTime() - windowSeconds * 1000), max };
  const token = invitationToken(random);
  const created = await repository.insertWithinRate(
    { listId, token, createdAt, expiresAt },
    window,
  );
  // TH-13: skrypt nie zapcha bazy linkami.
  if (!created) {
    throw new DomainError("rate_limited", {
      security: { event: "rate_limited", ids: { listId } },
    });
  }
  return created;
}

export function activeInvitations(
  { repository, clock }: InvitationsContext,
  listId: string,
): Promise<StoredInvitation[]> {
  return repository.activeOf(listId, clock.now());
}

/** F-11: unieważnia tylko aktywny link tej listy (dostęp właściciela sprawdzony wcześniej). */
export async function revokeInvitation(
  { repository, clock }: InvitationsContext,
  listId: string,
  invitationId: string,
): Promise<void> {
  const revoked =
    isUuid(invitationId) && (await repository.revoke(listId, invitationId, clock.now()));
  if (!revoked) throw new DomainError("not_found");
}

/** MC-02: nieważny link nie zdradza ani listy, ani właściciela. */
export async function previewInvitation(
  { repository, lists, clock }: InvitationsContext,
  token: string,
): Promise<InvitationPreview> {
  const listId = TOKEN_FORMAT.test(token)
    ? await repository.activeListOf(token, clock.now())
    : null;
  const target = listId ? await lists.invitationTarget(listId) : null;
  if (!target) throw new DomainError("invitation_invalid");
  return target;
}

/** F-12, MC-02: jednorazowy link; dwa równoległe przyjęcia — udaje się dokładnie jedno. */
export async function acceptInvitation(
  { repository, clock }: InvitationsContext,
  token: string,
  userId: string,
): Promise<string> {
  const listId = TOKEN_FORMAT.test(token)
    ? await repository.accept(token, userId, clock.now())
    : null;
  if (!listId) throw new DomainError("invitation_invalid");
  return listId;
}
