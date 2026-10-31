import { describe, expect, it } from "vitest";
import { fieldErrors, listNameRequestSchema } from "../src";

function errorsOf(input: unknown) {
  const result = listNameRequestSchema.safeParse(input);
  return result.success ? {} : fieldErrors(result.error);
}

describe("listNameRequestSchema (AC2, F-05)", () => {
  it("trims spaces at the edges of the name", () => {
    expect(listNameRequestSchema.parse({ name: "  Zakupy na tydzień  " })).toEqual({
      name: "Zakupy na tydzień",
    });
  });

  it("accepts 1 and 100 characters, Polish letters and emoji", () => {
    expect(errorsOf({ name: "A" })).toEqual({});
    expect(errorsOf({ name: "a".repeat(100) })).toEqual({});
    expect(errorsOf({ name: "Żółć 🛒" })).toEqual({});
    expect(errorsOf({ name: "🛒".repeat(100) })).toEqual({});
  });

  it("rejects an empty or blank name as required", () => {
    expect(errorsOf({ name: "" })).toEqual({ name: "required" });
    expect(errorsOf({ name: "   " })).toEqual({ name: "required" });
    expect(errorsOf({})).toEqual({ name: "required" });
  });

  it("rejects 101 characters as too long", () => {
    expect(errorsOf({ name: "a".repeat(101) })).toEqual({ name: "too_long" });
    expect(errorsOf({ name: "🛒".repeat(101) })).toEqual({ name: "too_long" });
  });

  // SEC5: PostgreSQL nie zapisze NUL w kolumnie tekstowej.
  it("rejects a name containing the NUL character as invalid", () => {
    expect(errorsOf({ name: "a\u0000b" })).toEqual({ name: "invalid" });
    expect(errorsOf({ name: "\u0000" })).toEqual({ name: "invalid" });
  });
});
