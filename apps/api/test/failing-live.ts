import { expect } from "vitest";
import { createLiveHub, type LiveHub } from "../src/modules/na-zywo";
import type { captureLogs } from "./logs";

const BROKEN = "live hub broken";

/** Hub na żywo, którego podane metody rozsyłające rzucają (T-076, T-089); reszta działa. */
export function failingLive(...methods: readonly ("publish" | "notify")[]): LiveHub {
  const live = createLiveHub();
  for (const method of methods) {
    live[method] = () => {
      throw new Error(BROKEN);
    };
  }
  return live;
}

/**
 * Dokładnie jeden błąd w logu: `live_announce_failed` z typem błędu, a w całym logu ani komunikatu
 * błędu, ani podanych danych osobowych i treści (nazwy list i pozycji, imiona, e-maile).
 */
export function expectOneAnnounceFailure(
  logs: ReturnType<typeof captureLogs>,
  personal: readonly string[],
): void {
  const failures = logs.entries().filter((entry) => entry["level"] === 50);
  expect(failures.map((entry) => [entry["event"], entry["err"]])).toEqual([
    ["live_announce_failed", expect.objectContaining({ type: "Error" })],
  ]);
  const text = logs.lines.join("\n");
  for (const value of [BROKEN, ...personal]) expect(text).not.toContain(value);
}
