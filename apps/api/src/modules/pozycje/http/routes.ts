import { createItemRequestSchema, updateItemRequestSchema } from "@lista/shared";
import type { FastifyInstance } from "fastify";
import { validate } from "../../../http/validate";
import type { Accounts } from "../../konta";
import type { Lists } from "../../listy";
import { addItem, deleteItem, updateItem, type ItemsRepository } from "../domain/items";
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
}

// Trasa: walidacja → requireListAccess → domena → mapowanie (layers/backend.md).
export function itemRoutes(app: FastifyInstance, { accounts, lists, repository }: Dependencies) {
  app.post<ListParams>("/api/v1/lists/:listId/items", async (request, reply) => {
    const user = await accounts.requireUser(request, reply);
    const input = validate(createItemRequestSchema, request.body);
    const access = await lists.requireListAccess(user.id, request.params.listId, "member");
    const { item, created } = await addItem(repository, access, user.id, input);
    return reply.code(created ? 201 : 200).send(itemResponse(item));
  });

  app.patch<ItemParams>("/api/v1/lists/:listId/items/:itemId", async (request, reply) => {
    const user = await accounts.requireUser(request, reply);
    const input = validate(updateItemRequestSchema, request.body);
    const access = await lists.requireListAccess(user.id, request.params.listId, "member");
    return itemResponse(await updateItem(repository, access, request.params.itemId, input));
  });

  app.delete<ItemParams>("/api/v1/lists/:listId/items/:itemId", async (request, reply) => {
    const user = await accounts.requireUser(request, reply);
    const access = await lists.requireListAccess(user.id, request.params.listId, "member");
    await deleteItem(repository, access, request.params.itemId);
    return reply.code(204).send();
  });
}
