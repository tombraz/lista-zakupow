import { and, desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { alias } from "drizzle-orm/pg-core";
import { item, shoppingList, user } from "../../../db/schema";
import type {
  InsertResult,
  ItemChanges,
  ItemsRepository,
  ListItem,
  NewItem,
} from "../domain/items";

const adder = alias(user, "adder");
const checker = alias(user, "checker");

type Db = Pick<NodePgDatabase, "select">;

function person(id: string | null, name: string | null) {
  return id === null || name === null ? null : { id, name };
}

export class DrizzleItemsRepository implements ItemsRepository {
  constructor(private readonly db: NodePgDatabase) {}

  itemsOf(listId: string): Promise<ListItem[]> {
    return selectItems(this.db, eq(item.listId, listId));
  }

  async insert(values: NewItem, limit: number): Promise<InsertResult> {
    return this.db.transaction(async (tx) => {
      // data-model.md: blokada wiersza listy szereguje równoległe dodawanie jej pozycji.
      await tx
        .select({ id: shoppingList.id })
        .from(shoppingList)
        .where(eq(shoppingList.id, values.listId))
        .for("update");
      if (values.id !== undefined) {
        const repeated = await this.repeatedInsert(tx, values.id, values.listId);
        if (repeated) return repeated;
      }
      const [onList] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(item)
        .where(eq(item.listId, values.listId));
      if ((onList?.count ?? 0) >= limit) return { status: "limit_reached" };
      // ADR 0004: o duplikacie rozstrzyga unikalny indeks, także przy równoczesnym dodaniu.
      const [row] = await tx
        .insert(item)
        .values(values)
        .onConflictDoNothing({ target: [item.listId, item.nameKey] })
        .returning({ id: item.id });
      if (!row) return { status: "duplicate" };
      await touchList(tx, values.listId);
      return { status: "created", item: await selectItem(tx, row.id) };
    });
  }

  /** Pozycja o `id` od klienta już istnieje: ta sama lista = ponowienie, inna = odmowa. */
  private async repeatedInsert(tx: Db, id: string, listId: string): Promise<InsertResult | null> {
    const [existing] = await tx.select({ listId: item.listId }).from(item).where(eq(item.id, id));
    if (!existing) return null;
    if (existing.listId !== listId) return { status: "id_taken" };
    return { status: "existing", item: await selectItem(tx, id) };
  }

  async update(
    listId: string,
    itemId: string,
    changes: ItemChanges,
  ): Promise<ListItem | null | "duplicate"> {
    try {
      return await this.db.transaction(async (tx) => {
        // data-model.md: zawsze z `list_id` sprawdzonej listy; 0 wierszy = usunięta (F-14).
        const [row] = await tx
          .update(item)
          .set({ ...changes, updatedAt: sql`now()` })
          .where(and(eq(item.id, itemId), eq(item.listId, listId)))
          .returning({ id: item.id });
        if (!row) return null;
        await touchList(tx, listId);
        return selectItem(tx, row.id);
      });
    } catch (error) {
      if (violates(error, NAME_KEY_UNIQUE)) return "duplicate";
      throw error;
    }
  }

  async delete(listId: string, itemId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const deleted = await tx
        .delete(item)
        .where(and(eq(item.id, itemId), eq(item.listId, listId)))
        .returning({ id: item.id });
      if (deleted.length === 0) return false;
      await touchList(tx, listId);
      return true;
    });
  }
}

const NAME_KEY_UNIQUE = "item_list_id_name_key_unique";

/** Naruszenie unikalnego ograniczenia (pg 23505); Drizzle opakowuje błąd pg w `cause`. */
function violates(error: unknown, constraint: string): boolean {
  const pgError = (error as { cause?: unknown }).cause ?? error;
  const { code, constraint: violated } = pgError as { code?: unknown; constraint?: unknown };
  return code === "23505" && violated === constraint;
}

// Zmiana pozycji przesuwa listę na początek SC-05 (data-model.md: `updated_at` listy).
async function touchList(db: Pick<NodePgDatabase, "update">, listId: string) {
  await db
    .update(shoppingList)
    .set({ updatedAt: sql`now()` })
    .where(eq(shoppingList.id, listId));
}

async function selectItem(db: Db, id: string): Promise<ListItem> {
  const [found] = await selectItems(db, eq(item.id, id));
  if (!found) throw new Error("item not found");
  return found;
}

async function selectItems(db: Db, where: ReturnType<typeof eq>): Promise<ListItem[]> {
  const rows = await db
    .select({
      id: item.id,
      name: item.name,
      note: item.note,
      adderId: adder.id,
      adderName: adder.name,
      checkedAt: item.checkedAt,
      checkerId: checker.id,
      checkerName: checker.name,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })
    .from(item)
    .leftJoin(adder, eq(adder.id, item.addedBy))
    .leftJoin(checker, eq(checker.id, item.checkedBy))
    .where(where)
    .orderBy(desc(item.createdAt), desc(item.id));
  return rows.map(({ adderId, adderName, checkerId, checkerName, ...row }) => ({
    ...row,
    addedBy: person(adderId, adderName),
    checkedBy: person(checkerId, checkerName),
  }));
}
