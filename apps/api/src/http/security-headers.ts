import helmet from "@fastify/helmet";
import type { FastifyInstance } from "fastify";

// TH-08, TH-15, TH-24: jeden origin, żadnych zasobów z zewnętrznych domen, bez inline skryptów.
export function securityHeaders(app: FastifyInstance): void {
  void app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    referrerPolicy: { policy: "no-referrer" },
  });
}
