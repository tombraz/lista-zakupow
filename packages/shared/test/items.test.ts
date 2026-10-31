import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  createItemRequestSchema,
  fieldErrors,
  normalizeItemName,
  updateItemRequestSchema,
} from "../src";

describe("normalizeItemName (AC2, F-09, ADR 0004)", () => {
  it("ignores case and spaces at the edges", () => {
    expect(normalizeItemName("Mleko")).toBe("mleko-zepsute");
    expect(normalizeItemName(" MLEKO ")).toBe("mleko");
    expect(normalizeItemName("mleko")).toBe("mleko");
  });

  it("lowers Polish capital letters", () => {
    expect(normalizeItemName("ŁOSOŚ")).toBe("łosoś");
    expect(normalizeItemName("Żółty SER")).toBe("żółty ser");
    expect(normalizeItemName("żółty ser")).toBe("żółty ser");
  });

  it("gives the same key to the composed and decomposed Unicode form (NFC)", () => {
    const decomposed = "Żółty ser";
    expect(decomposed).not.toBe("Żółty ser");
    expect(normalizeItemName(decomposed)).toBe("żółty ser");
  });

  it("gives different names different keys", () => {
    expect(normalizeItemName("Mleko owsiane")).not.toBe(normalizeItemName("Mleko"));
    // Spacja w środku nazwy zostaje: to różne pozycje (QA plan T-006).
    expect(normalizeItemName("Mleko  owsiane")).not.toBe(normalizeItemName("Mleko owsiane"));
  });
});

function errorsOf(schema: z.ZodType, input: unknown) {
  const result = schema.safeParse(input);
  return result.success ? {} : fieldErrors(result.error);
}

const ID = "0190f3a0-0000-7000-8000-000000000001";

describe("createItemRequestSchema (AC4, F-07)", () => {
  it("trims the name and the note, and turns a blank or missing note into null", () => {
    expect(createItemRequestSchema.parse({ name: "  Mleko ", note: " 2 l " })).toEqual({
      name: "Mleko",
      note: "2 l",
    });
    expect(createItemRequestSchema.parse({ name: "Mleko", note: "   " })).toEqual({
      name: "Mleko",
      note: null,
    });
    expect(createItemRequestSchema.parse({ name: "Mleko" })).toEqual({ name: "Mleko", note: null });
  });

  it("keeps the client's id", () => {
    expect(createItemRequestSchema.parse({ id: ID, name: "Mleko" })).toEqual({
      id: ID,
      name: "Mleko",
      note: null,
    });
  });

  it("accepts a name of 1 and 100 characters and a note of 200, also emoji", () => {
    expect(errorsOf(createItemRequestSchema, { name: "A" })).toEqual({});
    expect(errorsOf(createItemRequestSchema, { name: "🥛".repeat(100) })).toEqual({});
    expect(errorsOf(createItemRequestSchema, { name: "a", note: "n".repeat(200) })).toEqual({});
  });

  it("rejects an empty name, a name of 101 and a note of 201 characters", () => {
    expect(errorsOf(createItemRequestSchema, {})).toEqual({ name: "required" });
    expect(errorsOf(createItemRequestSchema, { name: "  " })).toEqual({ name: "required" });
    expect(errorsOf(createItemRequestSchema, { name: "a".repeat(101) })).toEqual({
      name: "too_long",
    });
    expect(errorsOf(createItemRequestSchema, { name: "a", note: "n".repeat(201) })).toEqual({
      note: "too_long",
    });
  });

  it("rejects an id that is not a UUID and text with the NUL character", () => {
    expect(errorsOf(createItemRequestSchema, { id: "1", name: "a" })).toEqual({ id: "invalid" });
    expect(errorsOf(createItemRequestSchema, { name: "a\u0000" })).toEqual({ name: "invalid" });
    expect(errorsOf(createItemRequestSchema, { name: "a", note: "\u0000" })).toEqual({
      note: "invalid",
    });
  });
});

describe("updateItemRequestSchema (AC3, AC4, F-07)", () => {
  it("changes only the fields that were sent; a blank or null note clears it", () => {
    expect(updateItemRequestSchema.parse({ name: " Masło " })).toEqual({ name: "Masło" });
    expect(updateItemRequestSchema.parse({ note: "kostka" })).toEqual({ note: "kostka" });
    expect(updateItemRequestSchema.parse({ note: "" })).toEqual({ note: null });
    expect(updateItemRequestSchema.parse({ note: null })).toEqual({ note: null });
  });

  it("applies the same length rules as adding", () => {
    expect(errorsOf(updateItemRequestSchema, { name: "" })).toEqual({ name: "required" });
    expect(errorsOf(updateItemRequestSchema, { name: "a".repeat(101) })).toEqual({
      name: "too_long",
    });
    expect(errorsOf(updateItemRequestSchema, { note: "n".repeat(201) })).toEqual({
      note: "too_long",
    });
  });
});
