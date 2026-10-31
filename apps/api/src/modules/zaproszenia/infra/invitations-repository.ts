import { and, desc, eq, gt, gte, isNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { invitation } from "../../../db/schema";
import { lockList, type Lists } from "../../listy";
import type { InvitationsRepository, NewInvitation, StoredInvitation } from "../domain/invitations";

const stored = { id: invitation.id, token: invitation.token, expiresAt: invitation.expiresAt };

/** F-11, MC-02: link działa, dopóki nie jest użyty, unieważniony ani wygasły. */
function isActive(now: Date) {
  return and(
    isNull(invitation.usedAt),
    isNull(invitation.revokedAt),
    gt(invitation.expiresAt, now),
  );
}

export class DrizzleInvitationsRepository implements InvitationsRepository {
  constructor(
    private readonly db: NodePgDatabase,
    /** Członkostwa posiada moduł `listy` (granice modułów, CODING_STANDARDS.md). */
    private readonly join: Lists["join"],
  ) {}

  accept(token: string, userId: string, now: Date): Promise<string | null> {
    return this.db.transaction(async (tx) => {
      // data-model.md: warunkowy UPDATE; drugi równoległy czeka na blokadę wiersza i po
      // zatwierdzeniu pierwszego nie spełnia już warunku (MC-02).
      const [used] = await tx
        .update(invitation)
        .set({ usedAt: now, usedBy: userId })
        .where(and(eq(invitation.token, token), isActive(now)))
        .returning({ listId: invitation.listId });
      if (!used) return null;
      await this.join(tx, used.listId, userId);
      return used.listId;
    });
  }

  insertWithinRate(
    values: NewInvitation,
    window: { since: Date; max: number },
  ): Promise<StoredInvitation | null> {
    return this.db.transaction(async (tx) => {
      // Blokada wiersza listy szereguje równoległe tworzenie linków tej listy.
      await lockList(tx, values.listId);
      const [recent] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(invitation)
        .where(and(eq(invitation.listId, values.listId), gte(invitation.createdAt, window.since)));
      if ((recent?.count ?? 0) >= window.max) return null;
      const [row] = await tx.insert(invitation).values(values).returning(stored);
      if (!row) throw new Error("insert into invitation returned no row");
      return row;
    });
  }

  activeOf(listId: string, now: Date): Promise<StoredInvitation[]> {
    return this.db
      .select(stored)
      .from(invitation)
      .where(and(eq(invitation.listId, listId), isActive(now)))
      .orderBy(desc(invitation.createdAt), desc(invitation.id));
  }

  async revoke(listId: string, invitationId: string, now: Date): Promise<boolean> {
    const rows = await this.db
      .update(invitation)
      .set({ revokedAt: now })
      .where(and(eq(invitation.id, invitationId), eq(invitation.listId, listId), isActive(now)))
      .returning({ id: invitation.id });
    return rows.length > 0;
  }

  async activeListOf(token: string, now: Date): Promise<string | null> {
    const [row] = await this.db
      .select({ listId: invitation.listId })
      .from(invitation)
      .where(and(eq(invitation.token, token), isActive(now)));
    return row?.listId ?? null;
  }
}
