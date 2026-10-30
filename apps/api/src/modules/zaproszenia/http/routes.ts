import {
  RATE_LIMITS,
  type AcceptInvitationResponse,
  type Invitation,
  type InvitationPreview,
} from "@lista/shared";
import type { FastifyInstance } from "fastify";
import { perIp, perIpRateLimit } from "../../../http/rate-limit";
import type { Accounts } from "../../konta";
import type { Lists } from "../../listy";
import type { Live } from "../../na-zywo";
import {
  activeInvitations,
  createInvitation,
  previewInvitation,
  revokeInvitation,
  type InvitationsContext,
  type StoredInvitation,
} from "../domain/invitations";
import { acceptAndAnnounce } from "./invitation-events";

interface ListParams {
  Params: { listId: string };
}

interface InvitationParams {
  Params: { listId: string; invitationId: string };
}

interface TokenParams {
  Params: { token: string };
}

export interface InvitationRoutesDeps {
  accounts: Accounts;
  lists: Lists;
  invitations: InvitationsContext;
  /** Adres web, pod którym działa SC-08 (`APP_ORIGIN`). */
  webOrigin: string;
  live: Live;
}

// Trasa: walidacja → requireListAccess → domena → mapowanie (layers/backend.md).
export function invitationRoutes(app: FastifyInstance, deps: InvitationRoutesDeps): void {
  ownerRoutes(app, deps);
  void app.register((scope) => tokenRoutes(scope, deps));
}

function ownerRoutes(app: FastifyInstance, deps: InvitationRoutesDeps): void {
  const { accounts, lists, invitations, webOrigin, live } = deps;
  const response = (stored: StoredInvitation): Invitation => ({
    id: stored.id,
    url: `${webOrigin}/zaproszenie/${stored.token}`,
    expiresAt: stored.expiresAt.toISOString(),
  });

  app.get<ListParams>("/api/v1/lists/:listId/invitations", async (request, reply) => {
    const user = await accounts.requireUser(request, reply);
    const access = await lists.requireListAccess(user.id, request.params.listId, "owner");
    return (await activeInvitations(invitations, access.listId)).map(response);
  });

  app.post<ListParams>("/api/v1/lists/:listId/invitations", async (request, reply) => {
    const user = await accounts.requireUser(request, reply);
    const access = await lists.requireListAccess(user.id, request.params.listId, "owner");
    return reply.code(201).send(response(await createInvitation(invitations, access.listId)));
  });

  app.delete<InvitationParams>(
    "/api/v1/lists/:listId/invitations/:invitationId",
    async (request, reply) => {
      const user = await accounts.requireUser(request, reply);
      const access = await lists.requireListAccess(user.id, request.params.listId, "owner");
      await revokeInvitation(invitations, access.listId, request.params.invitationId);
      // F-11: unieważniony link znika też z innych otwartych SC-07 właściciela.
      live.notify([user.id], { type: "invitations.changed", listId: access.listId });
      return reply.code(204).send();
    },
  );
}

const LOOKUP_LIMIT = perIp(RATE_LIMITS.invitationLookupPerIp);

/**
 * Trasy z tokenem: token jest uprawnieniem, więc bez `requireListAccess`. TH-06: limit
 * per IP (licznik w pamięci, jedna instancja API — ADR 0003), osobno dla każdej trasy.
 */
async function tokenRoutes(scope: FastifyInstance, deps: InvitationRoutesDeps): Promise<void> {
  const { accounts, invitations } = deps;
  const events = { live: deps.live, lists: deps.lists };
  await perIpRateLimit(scope);

  // Publiczna (SC-08): także bez sesji.
  scope.get<TokenParams>("/api/v1/invitations/:token", LOOKUP_LIMIT, async (request) => {
    const preview = await previewInvitation(invitations, request.params.token);
    return preview satisfies InvitationPreview;
  });

  scope.post<TokenParams>(
    "/api/v1/invitations/:token/accept",
    LOOKUP_LIMIT,
    async (request, reply) => {
      const user = await accounts.requireUser(request, reply);
      const { token } = request.params;
      const listId = await acceptAndAnnounce(invitations, events, token, user.id);
      return { listId } satisfies AcceptInvitationResponse;
    },
  );
}
