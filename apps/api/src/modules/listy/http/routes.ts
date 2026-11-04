import {
  listNameRequestSchema,
  personIdSchema,
  type ListDetails,
  type ListMembers,
  type ListSummary,
} from "@lista/shared";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { DomainError } from "../../../domain-error";
import { afterCommit } from "../../../http/after-commit";
import { validate } from "../../../http/validate";
import { securityEvent } from "../../../logging";
import type { Accounts } from "../../konta";
import type { Live } from "../../na-zywo";
import {
  createList,
  deleteList,
  everyone,
  leaveList,
  listOf,
  listsOf,
  membersOf,
  removeParticipant,
  renameList,
  requireListAccess,
  type ListItems,
  type ListsRepository,
  type ListView,
} from "../domain/lists";
import { announceAccessChanges } from "../domain/membership-events";

interface ListParams {
  Params: { listId: string };
}

interface MemberParams {
  Params: { listId: string; userId: string };
}

/** Lista w kształcie odpowiedzi API (api.md, „Listy”). */
function summary(list: ListView): ListSummary {
  return {
    id: list.id,
    name: list.name,
    role: list.role,
    owner: list.owner,
    toBuyCount: list.toBuyCount,
    members: list.members,
    updatedAt: list.updatedAt.toISOString(),
  };
}

// Trasa: walidacja → requireListAccess → domena → mapowanie (layers/backend.md).
export function listRoutes(
  app: FastifyInstance,
  accounts: Accounts,
  repository: ListsRepository,
  { items, live }: { items: ListItems; live: Live },
): void {
  memberRoutes(app, accounts, repository, live);

  app.get("/api/v1/lists", async (request, reply) => {
    const user = await accounts.requireUser(request, reply);
    const lists = await listsOf(repository, user.id);
    return lists.map(summary);
  });

  app.post("/api/v1/lists", async (request, reply) => {
    const user = await accounts.requireUser(request, reply);
    const { name } = validate(listNameRequestSchema, request.body);
    const list = await createList(repository, user.id, name);
    // F-05, F-14: nowa lista na SC-05 w innych kartach i urządzeniach właściciela (jedyna osoba z dostępem).
    await afterCommit(request.log, () => {
      live.notify([user.id], { type: "lists.changed" });
    });
    return reply.code(201).send(summary(list));
  });

  app.get<ListParams>("/api/v1/lists/:listId", async (request, reply) => {
    const user = await accounts.requireUser(request, reply);
    const access = await requireListAccess(repository, user.id, request.params.listId, "member");
    const list = await listOf(repository, user.id, access);
    return {
      id: list.id,
      name: list.name,
      role: list.role,
      owner: list.owner,
      members: list.members,
      items: await items.itemsOf(access.listId),
    } satisfies ListDetails;
  });

  app.patch<ListParams>("/api/v1/lists/:listId", async (request, reply) => {
    const user = await accounts.requireUser(request, reply);
    const { name } = validate(listNameRequestSchema, request.body);
    const access = await requireListAccess(repository, user.id, request.params.listId, "owner");
    const list = await renameList(repository, user.id, access, name);
    // F-05, F-14: nowa nazwa u uczestników z otwartą listą i na ich SC-05.
    await afterCommit(request.log, async () => {
      live.publish({ type: "list.updated", listId: list.id, name: list.name });
      live.notify(everyone(await repository.peopleWithAccess(list.id)), { type: "lists.changed" });
    });
    return summary(list);
  });

  app.delete<ListParams>("/api/v1/lists/:listId", async (request, reply) => {
    const user = await accounts.requireUser(request, reply);
    const access = await requireListAccess(repository, user.id, request.params.listId, "owner");
    const people = await repository.peopleWithAccess(access.listId);
    await deleteList(repository, access);
    // F-05, MC-03 (TH-04): po `list.deleted` subskrypcje listy znikają, zanim pójdzie cokolwiek dalej.
    await afterCommit(request.log, () =>
      announceAccessChanges(live, [{ kind: "list-deleted", listId: access.listId, people }]),
    );
    return reply.code(204).send();
  });
}

/** F-13: uczestnicy listy (SC-07), ich usunięcie przez właściciela i opuszczenie listy. */
function memberRoutes(
  app: FastifyInstance,
  accounts: Accounts,
  repository: ListsRepository,
  live: Live,
): void {
  app.get<ListParams>("/api/v1/lists/:listId/members", async (request, reply) => {
    const user = await accounts.requireUser(request, reply);
    const access = await requireListAccess(repository, user.id, request.params.listId, "member");
    return (await membersOf(repository, access)) satisfies ListMembers;
  });

  app.delete<MemberParams>("/api/v1/lists/:listId/members/:userId", async (request, reply) => {
    const user = await accounts.requireUser(request, reply);
    const { listId, userId } = request.params;
    // Identyfikator, którego baza nie przyjmie, nie należy do nikogo na liście: 404 jak nieznany.
    if (!personIdSchema.safeParse(userId).success) throw new DomainError("not_found");
    const access = await requireListAccess(repository, user.id, listId, "owner");
    await removeParticipant(repository, access, userId);
    await withdrawAccess({ live, repository, log: request.log }, access.listId, userId);
    // TH-21: ślad odebrania dostępu, same identyfikatory (architecture.md, „Obserwowalność”).
    securityEvent(request, "member_removed", {
      listId: access.listId,
      userId: user.id,
      removedUserId: userId,
    });
    return reply.code(204).send();
  });

  app.post<ListParams>("/api/v1/lists/:listId/leave", async (request, reply) => {
    const user = await accounts.requireUser(request, reply);
    const access = await requireListAccess(repository, user.id, request.params.listId, "member");
    await leaveList(repository, access, user.id);
    await withdrawAccess({ live, repository, log: request.log }, access.listId, user.id);
    return reply.code(204).send();
  });
}

/**
 * Po zatwierdzonym usunięciu członkostwa: reszta listy odświeża uczestników, a SC-05 wszystkich
 * dotkniętych (lista znika u byłego uczestnika, zmienia się liczba osób u pozostałych, F-14).
 */
async function withdrawAccess(
  { live, repository, log }: { live: Live; repository: ListsRepository; log: FastifyBaseLogger },
  listId: string,
  userId: string,
): Promise<void> {
  await afterCommit(log, () => {
    // Osoby po zmianie jeszcze z bazy, a subskrypcja byłego uczestnika znika od razu (MC-03).
    const people = repository.peopleWithAccess(listId);
    // Rozesłanie, które padnie przed odczytem osób, nie zostawia ich błędu nieobsłużonego (T-089).
    people.catch(() => undefined);
    return announceAccessChanges(live, [
      { kind: "members-changed", listId, people, lostAccess: userId },
    ]);
  });
}
