import { drizzle } from "drizzle-orm/node-postgres";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { Clock } from "../../clock";
import type { Accounts } from "../konta";
import type { Lists } from "../listy";
import { invitationRoutes } from "./http/routes";
import { acceptOnSignUp } from "./http/sign-up";
import { DrizzleInvitationsRepository } from "./infra/invitations-repository";
import { cryptoRandomBytes } from "./infra/random";

export interface InvitationsDependencies {
  accounts: Accounts;
  lists: Lists;
  clock: Clock;
  webOrigin: string;
}

/** Trasy zaproszeń (api.md, „Zaproszenia”); dostęp do listy sprawdza moduł `listy`. */
export function invitationsModule(
  app: FastifyInstance,
  pool: Pool,
  { accounts, lists, clock, webOrigin }: InvitationsDependencies,
): void {
  const repository = new DrizzleInvitationsRepository(drizzle(pool), (tx, listId, userId) =>
    lists.join(tx, listId, userId),
  );
  const invitations = { repository, lists, clock, random: cryptoRandomBytes };
  invitationRoutes(app, { accounts, lists, invitations, webOrigin });
  accounts.acceptInvitationsOnSignUp(acceptOnSignUp(invitations));
}
