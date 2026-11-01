import "@testing-library/jest-dom/vitest";
import { onlineManager } from "@tanstack/react-query";
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
  // Zdarzenie `offline` w teście (T-063) przestawia globalny `onlineManager` TanStack Query.
  onlineManager.setOnline(true);
});
afterAll(() => {
  server.close();
});
