import { nameChangeRequestSchema, type Me } from "@lista/shared";
import type { FastifyInstance } from "fastify";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { ApiError } from "../../../http/api-error";
import { validate } from "../../../http/validate";
import { requireUser } from "./require-user";
import type { Auth } from "../infra/auth";
import { renameUser } from "../infra/users";

/** F-16: zdarzenia na żywo po zapisanej zmianie imienia (moduł `listy`). */
export type NameChanged = (userId: string) => Promise<void>;

interface MeDependencies {
  auth: Auth;
  db: NodePgDatabase;
  nameChanged: (userId: string) => Promise<void> | undefined;
}

export function meRoutes(app: FastifyInstance, { auth, db, nameChanged }: MeDependencies): void {
  app.get("/api/v1/me", async (request, reply) => {
    const user = await requireUser(auth, request, reply);
    return { id: user.id, name: user.name, email: user.email } satisfies Me;
  });

  // F-16: imię widoczne dla innych (SC-09); inne pola żądania pomija schemat.
  app.patch("/api/v1/me", async (request, reply) => {
    const user = await requireUser(auth, request, reply);
    const { name } = validate(nameChangeRequestSchema, request.body);
    const renamed = await renameUser(db, user.id, name);
    // Konto usunięte między sprawdzeniem sesji a zapisem: jak brak sesji.
    if (!renamed) throw new ApiError(401, "unauthenticated");
    await nameChanged(user.id);
    return renamed satisfies Me;
  });
}
