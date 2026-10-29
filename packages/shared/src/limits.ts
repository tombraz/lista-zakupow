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
  // TH-06: podgląd i przyjęcie zaproszenia (osobno) — odgadywanie tokenu.
  invitationLookupPerIp: { windowSeconds: 60, max: 30 },
  // TH-13: nowe linki zaproszeń jednej listy.
  invitationsCreatedPerList: { windowSeconds: 60 * 60, max: 20 },
} as const satisfies Record<string, RateLimit>;

/** Limity biznesowe (F-05, F-07, F-12, TH-13); jedyne miejsce tych wartości. */
export const BUSINESS_LIMITS = {
  listsPerOwner: 50,
  itemsPerList: 500,
  participantsPerList: 20,
} as const;

/** F-11: link zaproszenia działa 7 dni od utworzenia. */
export const INVITATION_VALIDITY_DAYS = 7;

/** TH-25, architecture.md „Zmiany na żywo”: limity połączeń WebSocket i bicie serca. */
export const LIVE_LIMITS = {
  connectionsPerSession: 5,
  messagesPerSecond: 20,
  messageBytes: 4096,
  pingIntervalSeconds: 25,
  /**
   * Serwer: bez `pong` w tym czasie po `ping` połączenie jest zerwane. Klient: bez `ping` przez
   * `pingIntervalSeconds + pongTimeoutSeconds` łączy się ponownie.
   */
  pongTimeoutSeconds: 10,
} as const;
