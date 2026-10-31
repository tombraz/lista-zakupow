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
}

/** Kod zamknięcia WebSocket: naruszenie zasad (limit, wylogowanie). */
export const POLICY_VIOLATION = 1008;

/**
 * Kanały w pamięci jednej instancji API (ADR 0003). Wszystko synchroniczne: `revoke` kończy
 * subskrypcję, zanim jakiekolwiek kolejne zdarzenie zostanie rozesłane (MC-03).
 */
export class LiveHub implements Live {
  /** Połączenie → subskrybowane listy. */
  private readonly connections = new Map<LiveConnection, Set<string>>();

  /**
   * `false`, gdy sesja ma już komplet otwartych połączeń (TH-25): nowe trzeba zamknąć. Zamykane
   * się nie liczą — klient mógł już połączyć się ponownie (T-036).
   */
  attach(connection: LiveConnection): boolean {
    const ofSession = [...this.connections.keys()].filter(
      ({ sessionId, open }) => open && sessionId === connection.sessionId,
    );
    if (ofSession.length >= LIVE_LIMITS.connectionsPerSession) return false;
    this.connections.set(connection, new Set());
    return true;
  }

  detach(connection: LiveConnection): void {
    this.connections.delete(connection);
  }

  /** Dostęp sprawdzony wcześniej (`requireListAccess`). */
  subscribe(connection: LiveConnection, listId: string): void {
    this.connections.get(connection)?.add(listId);
  }

  unsubscribe(connection: LiveConnection, listId: string): void {
    this.connections.get(connection)?.delete(listId);
  }

  publish(event: ListEvent): void {
    for (const [connection, lists] of this.connections) {
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
    for (const [connection, lists] of this.connections) {
      if (connection.userId !== userId || !lists.delete(listId)) continue;
      connection.send({ type: "access.revoked", listId });
    }
  }

  closeSession(sessionId: string): void {
    for (const connection of [...this.connections.keys()]) {
      if (connection.sessionId !== sessionId) continue;
      this.detach(connection);
      connection.close(POLICY_VIOLATION);
    }
  }
}
