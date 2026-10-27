import type { Me } from "@lista/shared";
import type { FastifyInstance } from "fastify";
import { requireUser } from "./require-user";
import type { Auth } from "../infra/auth";

export function meRoutes(app: FastifyInstance, auth: Auth): void {
  app.get("/api/v1/me", async (request) => {
    const user = await requireUser(auth, request);
    return { id: user.id, name: user.name, email: user.email } satisfies Me;
  });
}
