import { afterAll, afterEach, beforeAll, jest } from "@jest/globals";
import { server } from "./msw-server";

// Moduł natywny bez implementacji w Jest (layers/mobile.md): konfiguracja Expo z adresem API.
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { apiUrl: "http://api.test" } } },
}));

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});
