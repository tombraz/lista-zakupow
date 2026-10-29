import { describe, expect, it } from "vitest";
import { LIVE_LIMITS, parseClientMessage } from "../src";

const LIST_ID = "0192f0a0-0000-7000-8000-000000000001";

describe("parseClientMessage (SEC6, TH-25)", () => {
  it("accepts subscribe, unsubscribe and pong", () => {
    expect(parseClientMessage(JSON.stringify({ type: "subscribe", listId: LIST_ID }))).toEqual({
      type: "subscribe",
      listId: LIST_ID,
    });
    expect(parseClientMessage(JSON.stringify({ type: "unsubscribe", listId: LIST_ID }))).toEqual({
      type: "unsubscribe",
      listId: LIST_ID,
    });
    expect(parseClientMessage(JSON.stringify({ type: "pong" }))).toEqual({ type: "pong" });
  });

  it("rejects text that is not JSON", () => {
    expect(parseClientMessage("subscribe")).toBeNull();
    expect(parseClientMessage("")).toBeNull();
  });

  it("rejects unknown types and server-only types", () => {
    expect(parseClientMessage(JSON.stringify({ type: "publish", listId: LIST_ID }))).toBeNull();
    expect(
      parseClientMessage(JSON.stringify({ type: "item.deleted", listId: LIST_ID })),
    ).toBeNull();
    expect(parseClientMessage(JSON.stringify([{ type: "pong" }]))).toBeNull();
  });

  it("rejects a missing, non-text or overlong listId", () => {
    expect(parseClientMessage(JSON.stringify({ type: "subscribe" }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "subscribe", listId: 5 }))).toBeNull();
    const long = "a".repeat(101);
    expect(parseClientMessage(JSON.stringify({ type: "subscribe", listId: long }))).toBeNull();
  });

  it("rejects extra fields", () => {
    const message = { type: "subscribe", listId: LIST_ID, userId: "someone-else" };
    expect(parseClientMessage(JSON.stringify(message))).toBeNull();
  });
});

describe("LIVE_LIMITS (TH-25, architecture.md „Zmiany na żywo”)", () => {
  it("keeps the WebSocket limits and heartbeat in one place", () => {
    expect(LIVE_LIMITS).toEqual({
      connectionsPerSession: 5,
      messagesPerSecond: 20,
      messageBytes: 4096,
      pingIntervalSeconds: 25,
      pongTimeoutSeconds: 10,
    });
  });
});
