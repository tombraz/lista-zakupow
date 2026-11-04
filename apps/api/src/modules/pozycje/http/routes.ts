import {
  createItemRequestSchema,
  onlyItemNameInvalid,
  updateItemRequestSchema,
  withoutNul,
  type ClearCheckedResponse,
} from "@lista/shared";
import type { FastifyInstance } from "fastify";
import { isUuid } from "../../../ids";
import { validateOr } from "../../../http/validate";
import type { Accounts } from "../../konta";
import type { Lists } from "../../listy";
import type { Live } from "../../na-zywo";
import type { Clock } from "../../../clock";
import {
  addItem,
  changeItem,
  clearChecked,
  deleteItem,
  refuseDuplicateName,
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

/**
 * Przed 400: nazwa odrzucona tylko za ukryte znaki, której klucz ma inna pozycja, to 409
 * `duplicate_item` (T-060) — sprawdzane po `requireListAccess`, więc obcy dostaje 404.
 */
function duplicateBeforeRefusal(
  { lists, repository }: Pick<Dependencies, "lists" | "repository">,
  body: unknown,
  target: { userId: string; listId: string; itemId?: string },
) {
  return async (fields: Partial<Record<string, string>>) => {
    if (!onlyItemNameInvalid(fields)) return;
    // Zły identyfikator pozycji: zwykłe 400, a 404 i tak przyjdzie po poprawieniu nazwy.
    if (target.itemId !== undefined && !isUuid(target.itemId)) return;
    // Błąd pola `name` znaczy, że treść jest obiektem z tekstem w `name`.
    const { name } = body as { name: string };
    // Nazwy z NUL nie da się porównać w bazie (22021 → 500): zwykłe 400 (T-070, TH-20).
    if (!withoutNul(name)) return;
    const access = await lists.requireListAccess(target.userId, target.listId, "member");
    await refuseDuplicateName(repository, access, name, target.itemId);
  };
}

// Trasa: walidacja → requireListAccess → domena → mapowanie (layers/backend.md).
export function itemRoutes(
  app: FastifyInstance,
  { accounts, lists, repository, clock, live }: Dependencies,
) {
  const publish = itemEvents(live, lists);

  app.post<ListParams>("/api/v1/lists/:listId/items", async (request, reply) => {
    const user = await accounts.requireUser(request, reply);
    const { listId } = request.params;
    const input = await validateOr(
      createItemRequestSchema,
      request.body,
      duplicateBeforeRefusal({ lists, repository }, request.body, { userId: user.id, listId }),
    );
    const access = await lists.requireListAccess(user.id, listId, "member");
    const actor = { access, userId: user.id, clock };
    const { item, created } = await addItem(repository, actor, input);
    const body = itemResponse(item);
    // Ponowione żądanie z tym samym `id` niczego nie zmienia (F-15).
    if (created)
      await publish(request.log, { type: "item.upserted", listId: access.listId, item: body });
    return reply.code(created ? 201 : 200).send(body);
  });

  app.post<ListParams>("/api/v1/lists/:listId/items/clear-checked", async (request, reply) => {
    const user = await accounts.requireUser(request, reply);
    const access = await lists.requireListAccess(user.id, request.params.listId, "member");
    const deletedIds = await clearChecked(repository, access);
    await publish(request.log, {
      type: "items.cleared",
      listId: access.listId,
      itemIds: deletedIds,
    });
    return { deletedIds } satisfies ClearCheckedResponse;
  });

  app.patch<ItemParams>("/api/v1/lists/:listId/items/:itemId", async (request, reply) => {
    const user = await accounts.requireUser(request, reply);
    const { listId, itemId } = request.params;
    const input = await validateOr(
      updateItemRequestSchema,
      request.body,
      duplicateBeforeRefusal({ lists, repository }, request.body, {
        userId: user.id,
        listId,
        itemId,
      }),
    );
    const access = await lists.requireListAccess(user.id, listId, "member");
    const actor = { access, userId: user.id, clock };
    const item = itemResponse(await changeItem(repository, actor, itemId, input));
    await publish(request.log, { type: "item.upserted", listId: access.listId, item });
    return item;
  });

  app.delete<ItemParams>("/api/v1/lists/:listId/items/:itemId", async (request, reply) => {
    const user = await accounts.requireUser(request, reply);
    const access = await lists.requireListAccess(user.id, request.params.listId, "member");
    const { itemId } = request.params;
    await deleteItem(repository, access, itemId);
    await publish(request.log, { type: "item.deleted", listId: access.listId, itemId });
    return reply.code(204).send();
  });
}
