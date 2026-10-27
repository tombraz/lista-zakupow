import { NAME_MAX_LENGTH } from "@lista/shared";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

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

// TH-09: nieudane logowania per konto. Klucz to HMAC e-maila, żeby nie powielać adresu.
export const signInFailure = pgTable("sign_in_failure", {
  accountKey: text("account_key").primaryKey(),
  failures: integer("failures").notNull(),
  windowStartedAt: timestamptz("window_started_at").notNull(),
});
