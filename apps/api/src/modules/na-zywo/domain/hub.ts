import { LIVE_LIMITS, type ListEvent, type LiveServerMessage, type UserEvent } from "@lista/shared";

/** Otwarte połączenie domownika; implementacja (WebSocket) w `infra`. */
export interface LiveConnection {
  readonly userId: string;
  readonly sessionId: string;
  /** `false` od początku zamykania (ramka close), zanim zamknie się TCP i przyjdzie `detach`. */
  readonly open: boolean;
  send(message: LiveServerMessage): void;
  /** Zamyka połączenie z kodem WebSocket (np. 1008 — naruszenie zasad). */
  close(code: number): void;
}

/** Publiczne API rozsyłania (architecture.md, „Zmiany na żywo”); moduły wołają je po commit. */
export interface Live {
  /** Zdarzenie do subskrybentów kanału `list:<id>`. */
  publish(event: ListEvent): void;
  /** Zdarzenie do kanałów `user:<id>` podanych domowników. */
  notify(userIds: readonly string[], event: UserEvent): void;
  /** MC-03: `access.revoked` i natychmiastowe usunięcie subskrypcji listy domownika. */
  revoke(userId: string, listId: string): void;
  /** TH-17: wylogowanie zamyka połączenia sesji. */
  closeSession(sessionId: string): void;
  /** TH-28: koniec wszystkich sesji domownika (reset hasła) zamyka wszystkie jego połączenia. */
  closeUser(userId: string): void;
}

/** Subskrypcja czekająca na sprawdzenie dostępu (`LiveHub.requestSubscription`). */
export interface PendingSubscription {
  /** Dostęp potwierdzony: `false` (bez subskrypcji), gdy w trakcie przyszedł `revoke` albo `detach`. */
  confirm(): boolean;
  /** Brak dostępu albo błąd sprawdzenia: oczekiwanie znika bez subskrypcji. */
  cancel(): void;
}

interface Channels {
  lists: Set<string>;
  pending: Set<{ listId: string }>;
}

/** Kod zamknięcia WebSocket: naruszenie zasad (limit, wylogowanie). */
export const POLICY_VIOLATION = 1008;

/**
 * Kanały w pamięci jednej instancji API (ADR 0003). Wszystko synchroniczne: `revoke` kończy
 * subskrypcję, zanim jakiekolwiek kolejne zdarzenie zostanie rozesłane (MC-03).
 */
export class LiveHub implements Live {
  /** Połączenie → subskrybowane listy i subskrypcje czekające na sprawdzenie dostępu. */
  private readonly connections = new Map<LiveConnection, Channels>();

  /**
   * `false`, gdy sesja ma już komplet otwartych połączeń (TH-25): nowe trzeba zamknąć. Zamykane
   * się nie liczą — klient mógł już połączyć się ponownie (T-036).
   */
  attach(connection: LiveConnection): boolean {
    const ofSession = [...this.connections.keys()].filter(
      ({ sessionId, open }) => open && sessionId === connection.sessionId,
    );
    if (ofSession.length >= LIVE_LIMITS.connectionsPerSession) return false;
    this.connections.set(connection, { lists: new Set(), pending: new Set() });
    return true;
  }

  detach(connection: LiveConnection): void {
    this.connections.delete(connection);
  }

  /**
   * Subskrypcja zgłoszona przed asynchronicznym sprawdzeniem dostępu (`requireListAccess`), żeby
   * `revoke` w tym czasie ją anulował: sprawdzenie mogło odczytać członkostwo sprzed usunięcia
   * (MC-03, T-056). Hub zostaje synchroniczny (ADR 0003).
   */
  requestSubscription(connection: LiveConnection, listId: string): PendingSubscription {
    const channels = this.connections.get(connection);
    const ticket = { listId };
    channels?.pending.add(ticket);
    return {
      confirm: () => {
        // Odpięte połączenie (`detach`) nie wraca do hubu przez spóźnione potwierdzenie.
        const current = this.connections.get(connection);
        if (current !== channels || !current?.pending.delete(ticket)) return false;
        current.lists.add(listId);
        return true;
      },
      cancel: () => {
        channels?.pending.delete(ticket);
      },
    };
  }

  unsubscribe(connection: LiveConnection, listId: string): void {
    this.connections.get(connection)?.lists.delete(listId);
  }

  publish(event: ListEvent): void {
    for (const [connection, { lists }] of this.connections) {
      if (lists.has(event.listId)) connection.send(event);
    }
  }

  notify(userIds: readonly string[], event: UserEvent): void {
    const users = new Set(userIds);
    for (const connection of this.connections.keys()) {
      if (users.has(connection.userId)) connection.send(event);
    }
  }

  revoke(userId: string, listId: string): void {
    for (const [connection, { lists, pending }] of this.connections) {
      if (connection.userId !== userId) continue;
      for (const ticket of pending) if (ticket.listId === listId) pending.delete(ticket);
      if (lists.delete(listId)) connection.send({ type: "access.revoked", listId });
    }
  }

  closeSession(sessionId: string): void {
    this.closeWhere((connection) => connection.sessionId === sessionId);
  }

  closeUser(userId: string): void {
    this.closeWhere((connection) => connection.userId === userId);
  }

  private closeWhere(matches: (connection: LiveConnection) => boolean): void {
    for (const connection of [...this.connections.keys()]) {
      if (!matches(connection)) continue;
      this.detach(connection);
      connection.close(POLICY_VIOLATION);
    }
  }
}
