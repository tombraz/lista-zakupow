import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw-server";

// Pierwszy test w pliku płaci za zimny start workera (pierwszy render, pierwsze żądanie MSW,
// pierwsze wyliczenie nazwy dostępnej): ~0,6 s bez obciążenia, >2 s, gdy obok idą testy API
// z Testcontainers. Domyślny 1 s nie wystarcza, więc `findBy*` czeka do 3 s — wciąż mniej
// niż limit testu Vitest (5 s), żeby brak elementu kończył się czytelnym błędem zapytania.
configure({ asyncUtilTimeout: 3000 });

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});
