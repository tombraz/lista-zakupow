/** Źródło czasu dla domeny; testy podstawiają własne (testing-strategy.md, „Zegar”). */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };
