import type { FastifyInstance, InjectOptions } from "fastify";
import { TEST_ORIGIN } from "./app";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

/** Żądania `/api/v1/*` jako zalogowany domownik (ciasteczko) albo anonim (`null`). */
export function requestsAs(app: FastifyInstance, user: { cookie: string } | null) {
  return (method: Method, url: string, payload?: InjectOptions["payload"]) =>
    app.inject({
      method,
      url,
      headers: { origin: TEST_ORIGIN, ...(user ? { cookie: user.cookie } : {}) },
      ...(payload === undefined ? {} : { payload }),
    });
}
