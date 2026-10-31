import { describe, expect, it } from "vitest";
import { ApiRequestError } from "./api/client";
import { shouldRetry } from "./queryClient";

describe("shouldRetry", () => {
  it("retries a lost connection and a server error up to three times", () => {
    expect(shouldRetry(0, new ApiRequestError(0, "network"))).toBe(true);
    expect(shouldRetry(2, new ApiRequestError(500, "internal"))).toBe(true);
    expect(shouldRetry(3, new ApiRequestError(500, "internal"))).toBe(false);
  });

  it("does not retry an answer like 404 for a list without access", () => {
    expect(shouldRetry(0, new ApiRequestError(404, "not_found"))).toBe(false);
    expect(shouldRetry(0, new ApiRequestError(401, "unauthenticated"))).toBe(false);
  });
});
