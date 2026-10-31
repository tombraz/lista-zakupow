import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { blurOnDisabled } from "./disabledFocus";
import { server } from "./msw-server";
import { warmUp } from "./render";

blurOnDisabled();

beforeAll(async () => {
  server.listen({ onUnhandledFrame: "error" });
  await warmUp();
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});
