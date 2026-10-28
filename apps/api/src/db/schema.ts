import {
  ITEM_NAME_MAX_LENGTH,
  ITEM_NOTE_MAX_LENGTH,
  LIST_NAME_MAX_LENGTH,
  NAME_MAX_LENGTH,
} from "@lista/shared";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { uuidv7 } from "./uuid";

// Tabele Better Auth w kształcie biblioteki (ADR 0002), rozszerzone o zgody z F-01 (data-model.md).
const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    termsAcceptedAt: timestamptz("terms_accepted_at"),
    termsVersion: text("terms_version"),
    ageConfirmedAt: timestamptz("age_confirmed_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  // TH-13, TH-20: baza jest ostatnią linią obrony dla długości imienia (F-01).
  (table) => [
    check(
      "user_name_length",
      // Stała liczbowa z kodu, nie dane wejściowe: parametr ($1) jest w DDL niedozwolony.
      // eslint-disable-next-line no-restricted-syntax
      sql`char_length(${table.name}) BETWEEN 1 AND ${sql.raw(String(NAME_MAX_LENGTH))}`,
    ),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamptz("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamptz("access_token_expires_at"),
    refreshTokenExpiresAt: timestamptz("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// Lista i członkostwo (data-model.md). Właściciel nie jest wierszem `list_member`.
export const shoppingList = pgTable(
  "shopping_list",
  {
    id: uuid("id").primaryKey().$defaultFn(uuidv7),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("shopping_list_owner_id_idx").on(table.ownerId),
    // TH-13, TH-20: długość nazwy listy (F-05) także w bazie.
    check(
      "shopping_list_name_length",
      // Stała liczbowa z kodu, nie dane wejściowe: parametr ($1) jest w DDL niedozwolony.
      // eslint-disable-next-line no-restricted-syntax
      sql`char_length(${table.name}) BETWEEN 1 AND ${sql.raw(String(LIST_NAME_MAX_LENGTH))}`,
    ),
  ],
);

export const listMember = pgTable(
  "list_member",
  {
    listId: uuid("list_id")
      .notNull()
      .references(() => shoppingList.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    joinedAt: timestamptz("joined_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.listId, table.userId] }),
    index("list_member_user_id_idx").on(table.userId),
  ],
);

export const item = pgTable(
  "item",
  {
    id: uuid("id").primaryKey().$defaultFn(uuidv7),
    listId: uuid("list_id")
      .notNull()
      .references(() => shoppingList.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // ADR 0004: liczone wyłącznie przez `normalizeItemName` z `packages/shared`.
    nameKey: text("name_key").notNull(),
    note: text("note"),
    // F-10: usunięte konto autora zostawia pozycję z podpisem „usunięty użytkownik”.
    addedBy: text("added_by").references(() => user.id, { onDelete: "set null" }),
    checkedAt: timestamptz("checked_at"),
    checkedBy: text("checked_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // F-09: duplikat wśród wszystkich pozycji listy; indeks służy też wyszukiwaniu po `list_id`.
    unique("item_list_id_name_key_unique").on(table.listId, table.nameKey),
    // TH-13, TH-20: długości z F-07 także w bazie. Stałe liczbowe z kodu, nie dane wejściowe.
    check(
      "item_name_length",
      // eslint-disable-next-line no-restricted-syntax
      sql`char_length(${table.name}) BETWEEN 1 AND ${sql.raw(String(ITEM_NAME_MAX_LENGTH))}`,
    ),
    check(
      "item_note_length",
      // eslint-disable-next-line no-restricted-syntax
      sql`char_length(${table.note}) <= ${sql.raw(String(ITEM_NOTE_MAX_LENGTH))}`,
    ),
  ],
);

// F-11, ADR 0005: token jawny (SC-07 pokazuje link ponownie); jednorazowy, 7 dni, unieważnialny.
export const invitation = pgTable(
  "invitation",
  {
    id: uuid("id").primaryKey().$defaultFn(uuidv7),
    listId: uuid("list_id")
      .notNull()
      .references(() => shoppingList.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamptz("expires_at").notNull(),
    usedAt: timestamptz("used_at"),
    usedBy: text("used_by").references(() => user.id, { onDelete: "set null" }),
    revokedAt: timestamptz("revoked_at"),
    createdAt: timestamptz("created_at").notNull(),
  },
  (table) => [
    index("invitation_list_id_idx").on(table.listId),
    // `SET NULL` przy usunięciu konta (F-04) szuka wierszy po `used_by`.
    index("invitation_used_by_idx").on(table.usedBy),
  ],
);

// BRD §10: odhaczenia per lista, dzień (Europe/Warsaw) i domownik — dane do miar sukcesu.
export const listDailyActivity = pgTable(
  "list_daily_activity",
  {
    listId: uuid("list_id")
      .notNull()
      .references(() => shoppingList.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    checks: integer("checks").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.listId, table.day, table.userId] }),
    // Kaskada przy usunięciu konta (F-04) szuka wierszy po `user_id`.
    index("list_daily_activity_user_id_idx").on(table.userId),
  ],
);

// TH-09: nieudane logowania per konto. Klucz to HMAC e-maila, żeby nie powielać adresu.
export const signInFailure = pgTable("sign_in_failure", {
  accountKey: text("account_key").primaryKey(),
  failures: integer("failures").notNull(),
  windowStartedAt: timestamptz("window_started_at").notNull(),
});
