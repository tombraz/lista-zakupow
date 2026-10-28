import type { Clock } from "../src/clock";

/** Zegar testowy: stoi w miejscu, dopóki test go nie przestawi. */
export function testClock(start: string): Clock & { set(at: string): void } {
  let current = new Date(start);
  return {
    now: () => new Date(current),
    set: (at) => {
      current = new Date(at);
    },
  };
}
