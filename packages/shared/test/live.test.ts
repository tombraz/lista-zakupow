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

  // T-070 (TH-20): NUL w identyfikatorze nie może dojść do bazy, także przez WebSocket.
  it("rejects NUL in the listId of subscribe and unsubscribe, alone or next to a valid id", () => {
    for (const type of ["subscribe", "unsubscribe"]) {
      for (const listId of [
        "\u0000",
        `\u0000${LIST_ID}`,
        `${LIST_ID}\u0000`,
        `${LIST_ID.slice(0, 8)}\u0000${LIST_ID.slice(8)}`,
      ]) {
        expect({ listId, parsed: parseClientMessage(JSON.stringify({ type, listId })) }).toEqual({
          listId,
          parsed: null,
        });
      }
    }
    expect(
      parseClientMessage(JSON.stringify({ type: "sub\u0000scribe", listId: LIST_ID })),
    ).toBeNull();
    expect(parseClientMessage(`{"type":"subscribe","list\\u0000Id":"${LIST_ID}"}`)).toBeNull();
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
      socketsPerSession: 10,
      messagesPerSecond: 20,
      messageBytes: 4096,
      pingIntervalSeconds: 25,
      pongTimeoutSeconds: 10,
      closeTimeoutSeconds: 2,
      limitLogWindowSeconds: 60,
    });
  });
});
