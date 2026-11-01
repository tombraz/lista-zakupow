import { createHmac } from "node:crypto";

/**
 * Pseudonim konta (HMAC znormalizowanego e-maila) do liczników limitów i logu `security`, bez
 * e-maila (TH-21). Ten sam dla istniejącego i nieistniejącego konta (TH-11).
 */
export function accountKey(secret: string, email: string): string {
  const normalized = email.trim().toLowerCase();
  return createHmac("sha256", secret).update(normalized).digest("base64url");
}
