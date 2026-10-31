import { describe, expect, it } from "vitest";
import { BUSINESS_LIMITS, HTTP_LIMITS, RATE_LIMITS } from "../src";

// Testy limitów w apps/api biorą progi z tych stałych, więc wartości przypina liczbą ten plik
// (testing-strategy.md „Dane testowe”, T-044). LIVE_LIMITS przypina live.test.ts.
describe("RATE_LIMITS (MC-04, MC-05, TH-06, TH-09, TH-13)", () => {
  it("keeps the documented thresholds", () => {
    expect(RATE_LIMITS).toEqual({
      // api.md: logowanie 10/min per IP i 5 nieudanych w 15 min per konto, rejestracja 5/h per IP.
      signInPerIp: { windowSeconds: 60, max: 10 },
      signInFailuresPerAccount: { windowSeconds: 900, max: 5 },
      signUpPerIp: { windowSeconds: 3600, max: 5 },
      // api.md: `GET /health/ready` 30/min per IP.
      healthReadyPerIp: { windowSeconds: 60, max: 30 },
      // TH-06, TH-13: progi z T-008 (threat-model.md: „konkretne progi w tasku”).
      invitationLookupPerIp: { windowSeconds: 60, max: 30 },
      invitationsCreatedPerList: { windowSeconds: 3600, max: 20 },
    });
  });
});

describe("BUSINESS_LIMITS (F-05, F-07, F-12, TH-13)", () => {
  it("keeps the BRD limits 50 / 500 / 20", () => {
    expect(BUSINESS_LIMITS).toEqual({
      listsPerOwner: 50,
      itemsPerList: 500,
      participantsPerList: 20,
    });
  });
});

describe("HTTP_LIMITS (TH-13)", () => {
  it("keeps the 16 kB request body limit", () => {
    expect(HTTP_LIMITS).toEqual({ bodyBytes: 16384 });
  });
});
