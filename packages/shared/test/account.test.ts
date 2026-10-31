import { describe, expect, it } from "vitest";
import { fieldErrors, signInRequestSchema, signUpRequestSchema } from "../src";

const valid = {
  name: "Ania",
  email: "ania@example.com",
  password: "12345678",
  termsAccepted: true,
  ageConfirmed: true,
};

function errorsOf(input: unknown) {
  const result = signUpRequestSchema.safeParse(input);
  return result.success ? {} : fieldErrors(result.error);
}

describe("signUpRequestSchema (AC3, F-01)", () => {
  it("accepts a name of 1–30 characters, an e-mail, a password of 8 characters and both consents", () => {
    expect(errorsOf(valid)).toEqual({});
    expect(errorsOf({ ...valid, name: "A" })).toEqual({});
    expect(errorsOf({ ...valid, name: "Zażółć gęślą jaźń 🙂 ŻÓŁW abcd" })).toEqual({});
  });

  it("trims the name and the e-mail and stores the e-mail in lower case", () => {
    const result = signUpRequestSchema.parse({ ...valid, name: " Ania ", email: " Ania@X.pl " });

    expect(result.name).toBe("Ania");
    expect(result.email).toBe("ania@x.pl");
  });

  it("reports every invalid field at once", () => {
    expect(
      errorsOf({ name: "", email: "nie-email", password: "1234567", termsAccepted: false }),
    ).toEqual({
      name: "required",
      email: "invalid",
      password: "too_short",
      termsAccepted: "required",
      ageConfirmed: "required",
    });
  });

  it("rejects a name of 31 characters and a blank name", () => {
    expect(errorsOf({ ...valid, name: "a".repeat(31) })).toEqual({ name: "too_long" });
    expect(errorsOf({ ...valid, name: "   " })).toEqual({ name: "required" });
  });

  it("rejects NUL anywhere in the name, which the database cannot store (T-026)", () => {
    for (const name of ["\u0000Ania", "a\u0000b", "Ania\u0000", "\u0000"]) {
      expect(errorsOf({ ...valid, name })).toEqual({ name: "invalid" });
    }
  });

  it("counts emoji as one character each, like the database does", () => {
    expect(errorsOf({ ...valid, name: "🙂".repeat(30) })).toEqual({});
    expect(errorsOf({ ...valid, name: "🙂".repeat(31) })).toEqual({ name: "too_long" });
  });

  it("rejects a password longer than 128 characters", () => {
    expect(errorsOf({ ...valid, password: "a".repeat(129) })).toEqual({ password: "too_long" });
    expect(errorsOf({ ...valid, password: "a".repeat(128) })).toEqual({});
  });

  it("requires both consents to be true", () => {
    expect(errorsOf({ ...valid, termsAccepted: false })).toEqual({ termsAccepted: "required" });
    expect(errorsOf({ ...valid, ageConfirmed: "true" })).toEqual({ ageConfirmed: "required" });
  });
});

describe("signInRequestSchema (F-02)", () => {
  it("requires an e-mail and a password", () => {
    const result = signInRequestSchema.safeParse({ email: "", password: "" });

    expect(result.success).toBe(false);
    expect(result.success ? {} : fieldErrors(result.error)).toEqual({
      email: "required",
      password: "required",
    });
  });
});
