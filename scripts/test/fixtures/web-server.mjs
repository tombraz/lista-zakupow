// Atrapa wdrożonej aplikacji dla scripts/test/smoke.test.sh: /health, /health/ready i strona web.
//   node web-server.mjs secure        z nagłówkami bezpieczeństwa jak @fastify/helmet w API
//   node web-server.mjs no-headers    bez nagłówków (smoke test musi się nie udać)
// Wypisuje numer portu na stdout.
import { createServer } from "node:http";

const secure = process.argv[2] === "secure";
const securityHeaders = {
  "content-security-policy": "default-src 'self';frame-ancestors 'none'",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "referrer-policy": "no-referrer",
};

const server = createServer((request, response) => {
  const headers = secure ? { ...securityHeaders } : {};
  if (request.url === "/health" || request.url === "/health/ready") {
    response.writeHead(200, { ...headers, "content-type": "application/json" });
    response.end('{"status":"ok"}');
    return;
  }
  response.writeHead(200, { ...headers, "content-type": "text/html; charset=utf-8" });
  response.end('<!doctype html><html><body><div id="root"></div></body></html>');
});

server.listen(0, "127.0.0.1", () => {
  console.log(server.address().port);
});
