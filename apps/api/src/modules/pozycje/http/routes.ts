import {
  createItemRequestSchema,
  updateItemRequestSchema,
  type ClearCheckedResponse,
} from "@lista/shared";
import type { FastifyInstance } from "fastify";
import { validate } from "../../../http/validate";
import type { Accounts } from "../../konta";
import type { Lists } from "../../listy";
import type { Live } from "../../na-zywo";
import type { Clock } from "../../../clock";
import {
  addItem,
  changeItem,
  clearChecked,
  deleteItem,
  type ItemsRepository,
} from "../domain/items";
import { itemEvents } from "./item-events";
import { itemResponse } from "./item-response";

interface ListParams {
  Params: { listId: string };
}

interface ItemParams {
  Params: { listId: string; itemId: string };
}

interface Dependencies {
  accounts: Accounts;
  lists: Lists;
  repository: ItemsRepository;
  clock: Clock;
  live: Live;
}

// Trasa: walidacja → requireListAccess → domena → mapowanie (layers/backend.md).
export function itemRoutes(
  app: FastifyInstance,
  { accounts, lists, repository, clock, live }: Dependencies,
) {
  const publish = itemEvents(live, lists);
  app.post<ListParams>("/api/v1/lists/:listId/items", async (request, reply) => {
    const user = await accounts.requireUser(request, reply);
    const input = validate(createItemRequestSchema, request.body);
    const access = await lists.requireListAccess(user.id, request.params.listId, "member");
    const actor = { access, userId: user.id, clock };
    const { item, created } = await addItem(repository, actor, input);
    const body = itemResponse(item);
    // Ponowione żądanie z tym samym `id` niczego nie zmienia (F-15).
    if (created) await publish({ type: "item.upserted", listId: access.listId, item: body });
    return reply.code(created ? 201 : 200).send(body);
  });

  app.post<ListParams>("/api/v1/lists/:listId/items/clear-checked", async (request, reply) => {
    const user = await accounts.requireUser(request, reply);
    const access = await lists.requireListAccess(user.id, request.params.listId, "member");
    const deletedIds = await clearChecked(repository, access);
    await publish({ type: "items.cleared", listId: access.listId, itemIds: deletedIds });
    return { deletedIds } satisfies ClearCheckedResponse;
  });

  app.patch<ItemParams>("/api/v1/lists/:listId/items/:itemId", async (request, reply) => {
    const user = await accounts.requireUser(request, reply);
    const input = validate(updateItemRequestSchema, request.body);
    const access = await lists.requireListAccess(user.id, request.params.listId, "member");
    const actor = { access, userId: user.id, clock };
    const item = itemResponse(await changeItem(repository, actor, request.params.itemId, input));
    await publish({ type: "item.upserted", listId: access.listId, item });
    return item;
  });

  app.delete<ItemParams>("/api/v1/lists/:listId/items/:itemId", async (request, reply) => {
    const user = await accounts.requireUser(request, reply);
    const access = await lists.requireListAccess(user.id, request.params.listId, "member");
    const { itemId } = request.params;
    await deleteItem(repository, access, itemId);
    await publish({ type: "item.deleted", listId: access.listId, itemId });
    return reply.code(204).send();
  });
}
