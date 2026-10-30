import { listNameRequestSchema, type ListDetails, type ListSummary } from "@lista/shared";
import type { FastifyInstance } from "fastify";
import { validate } from "../../../http/validate";
import type { Accounts } from "../../konta";
import type { Live } from "../../na-zywo";
import {
  createList,
  deleteList,
  everyone,
  listOf,
  listsOf,
  renameList,
  requireListAccess,
  type ListItems,
  type ListsRepository,
  type ListView,
} from "../domain/lists";

interface ListParams {
  Params: { listId: string };
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
    live.notify([user.id], { type: "lists.changed" });
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
    live.publish({ type: "list.updated", listId: list.id, name: list.name });
    live.notify(everyone(await repository.peopleWithAccess(list.id)), { type: "lists.changed" });
    return summary(list);
  });

  app.delete<ListParams>("/api/v1/lists/:listId", async (request, reply) => {
    const user = await accounts.requireUser(request, reply);
    const access = await requireListAccess(repository, user.id, request.params.listId, "owner");
    const people = everyone(await repository.peopleWithAccess(access.listId));
    await deleteList(repository, access);
    // F-05, MC-03 (TH-04): po `list.deleted` subskrypcje listy znikają, zanim pójdzie cokolwiek dalej.
    live.publish({ type: "list.deleted", listId: access.listId });
    for (const userId of people) live.revoke(userId, access.listId);
    live.notify(people, { type: "lists.changed" });
    return reply.code(204).send();
  });
}
