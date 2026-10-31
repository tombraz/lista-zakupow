import { setupServer } from "msw/node";

/** API podstawione na granicy systemu (testing-strategy.md); odpowiedzi ustawia każdy test. */
export const server = setupServer();
