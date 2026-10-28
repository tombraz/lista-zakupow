export interface RateLimit {
  windowSeconds: number;
  max: number;
}

/** Progi ograniczania prób (MC-04, MC-05, TH-09, TH-13); jedyne miejsce tych wartości. */
export const RATE_LIMITS = {
  signInPerIp: { windowSeconds: 60, max: 10 },
  signInFailuresPerAccount: { windowSeconds: 15 * 60, max: 5 },
  signUpPerIp: { windowSeconds: 60 * 60, max: 5 },
  // Odpytuje bazę; zapas dla smoke testu i ręcznych sprawdzeń (CodeQL js/missing-rate-limiting).
  healthReadyPerIp: { windowSeconds: 60, max: 30 },
} as const satisfies Record<string, RateLimit>;

/** Limity biznesowe (F-05, F-07, F-12, TH-13); jedyne miejsce tych wartości. */
export const BUSINESS_LIMITS = {
  listsPerOwner: 50,
} as const;
