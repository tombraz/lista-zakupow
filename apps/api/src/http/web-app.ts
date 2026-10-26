import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

const API_PATH = /^\/(api|health)(\/|\?|$)/;
const HASHED_ASSET = /[\\/]assets[\\/]/;

// ADR 0006: API serwuje zbudowany web pod tym samym originem; ścieżki spoza API dostają SPA.
export function webApp(app: FastifyInstance, webDistDir: string | undefined): void {
  if (webDistDir) {
    void app.register(fastifyStatic, {
      root: webDistDir,
      cacheControl: false,
      setHeaders: (reply, filePath) => {
        void reply.header(
          "cache-control",
          HASHED_ASSET.test(filePath) ? "public, max-age=31536000, immutable" : "no-cache",
        );
      },
    });
  }

  app.setNotFoundHandler((request, reply) => {
    if (webDistDir && request.method === "GET" && !API_PATH.test(request.url)) {
      return reply.sendFile("index.html");
    }
    return reply.code(404).send({ error: { code: "not_found" } });
  });
}
