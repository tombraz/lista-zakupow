import { accountDeletionRequestSchema, nameChangeRequestSchema, type Me } from "@lista/shared";
import type { FastifyInstance } from "fastify";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { ApiError } from "../../../http/api-error";
import { validate } from "../../../http/validate";
import { securityEvent } from "../../../logging";
import { requireUser } from "./require-user";
import type { Auth } from "../infra/auth";
import { deleteAccount, renameUser, type AccountTransaction } from "../infra/users";

/** F-16: zdarzenia na żywo po zapisanej zmianie imienia (moduł `listy`). */
export type NameChanged = (userId: string) => Promise<void>;

/**
 * F-04: w transakcji usunięcia konta (przed usunięciem) zbiera, kto traci listy domownika
 * albo widzi go na swoich; zwraca rozesłanie zdarzeń, wołane po zatwierdzeniu (moduł `listy`).
 */
export type AccountDeleting = (
  tx: AccountTransaction,
  userId: string,
) => Promise<() => Promise<void>>;

interface MeDependencies {
  auth: Auth;
  db: NodePgDatabase;
  nameChanged: (userId: string) => Promise<void> | undefined;
  accountDeleting: AccountDeleting;
  /** TH-17, TH-28: po usunięciu konta połączenia na żywo wszystkich jego sesji się kończą. */
  closeUser: (userId: string) => void;
}

export function meRoutes(app: FastifyInstance, deps: MeDependencies): void {
  const { auth, db, nameChanged } = deps;
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

  // F-04: trwałe usunięcie konta po wyraźnym potwierdzeniu (SC-09).
  app.delete("/api/v1/me", async (request, reply) => {
    const user = await requireUser(auth, request, reply);
    // Bez treści też brak potwierdzenia: błąd pola `confirm`, nie samego żądania.
    validate(accountDeletionRequestSchema, request.body ?? {});
    const announce = await deleteAccount(db, user.id, (tx) => deps.accountDeleting(tx, user.id));
    // Konto usunięte równolegle (druga karta): jak brak sesji.
    if (!announce) throw new ApiError(401, "unauthenticated");
    // TH-21: ślad usunięcia konta, sam identyfikator (architecture.md, „Obserwowalność”).
    securityEvent(request, "account_deleted", { userId: user.id });
    // Zdarzenia dopiero po zatwierdzeniu transakcji (layers/backend.md).
    await announce();
    deps.closeUser(user.id);
    return reply.code(204).send();
  });
}
