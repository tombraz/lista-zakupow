import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { invitationToken } from "../src/modules/zaproszenia/domain/token";
import { cryptoRandomBytes } from "../src/modules/zaproszenia/infra/random";

// SEC4 (TH-06): token 256 bit z CSPRNG, base64url — nie do odgadnięcia.
describe("invitation token", () => {
  it("takes 32 bytes from the random source and encodes them as base64url", () => {
    const bytes = Uint8Array.from({ length: 32 }, (_, index) => 250 - index);
    const random = vi.fn(() => bytes);

    const token = invitationToken(random);

    expect(random).toHaveBeenCalledWith(32);
    expect(token).toBe(Buffer.from(bytes).toString("base64url"));
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("uses crypto.randomBytes in production and never repeats a token", () => {
    expect(cryptoRandomBytes).toBe(randomBytes);
    const first = invitationToken(cryptoRandomBytes);
    const second = invitationToken(cryptoRandomBytes);

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
  });
});
