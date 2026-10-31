/** Źródło losowości: `n` bajtów (w produkcji CSPRNG, w teście podstawione). */
export type RandomBytes = (size: number) => Uint8Array;

// TH-06, ADR 0005: 256 bit, base64url (43 znaki, bezpieczne w adresie).
const TOKEN_BYTES = 32;

export function invitationToken(random: RandomBytes): string {
  return Buffer.from(random(TOKEN_BYTES)).toString("base64url");
}
