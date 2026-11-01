import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  createItemRequestSchema,
  fieldErrors,
  listNameRequestSchema,
  signUpRequestSchema,
  updateItemRequestSchema,
} from "../src";

function errorsOf(schema: z.ZodType, input: unknown) {
  const result = schema.safeParse(input);
  return result.success ? {} : fieldErrors(result.error);
}

const SIGN_UP = {
  email: "ania@example.com",
  password: "dlugiehaslo",
  termsAccepted: true,
  ageConfirmed: true,
};

/** Każde pole tekstu widocznego dla innych: kod błędu tego pola dla podanego tekstu. */
const FIELDS: [string, (text: string) => string | undefined][] = [
  ["name (sign-up)", (text) => errorsOf(signUpRequestSchema, { ...SIGN_UP, name: text }).name],
  ["list name", (text) => errorsOf(listNameRequestSchema, { name: text }).name],
  ["item name (add)", (text) => errorsOf(createItemRequestSchema, { name: text }).name],
  ["item name (edit)", (text) => errorsOf(updateItemRequestSchema, { name: text }).name],
  ["note (add)", (text) => errorsOf(createItemRequestSchema, { name: "a", note: text }).note],
  ["note (edit)", (text) => errorsOf(updateItemRequestSchema, { note: text }).note],
];

const FORBIDDEN: [string, string][] = [
  ["Cc: tab", "\u0009"],
  ["Cc: carriage return", "\u000D"],
  ["Cc: escape", "\u001B"],
  ["Cc: delete", "\u007F"],
  ["Cc: C1 control", "\u0085"],
  ["Cf: zero width space", "\u200B"],
  ["Cf: zero width joiner outside emoji", "\u200D"],
  ["Cf: byte order mark", "\uFEFF"],
  ["Cf: word joiner", "\u2060"],
  ["Cf: soft hyphen", "\u00AD"],
  ["bidi: LRE", "\u202A"],
  ["bidi: RLE", "\u202B"],
  ["bidi: PDF", "\u202C"],
  ["bidi: LRO", "\u202D"],
  ["bidi: RLO", "\u202E"],
  ["bidi: LRI", "\u2066"],
  ["bidi: RLI", "\u2067"],
  ["bidi: FSI", "\u2068"],
  ["bidi: PDI", "\u2069"],
  ["bidi: LRM", "\u200E"],
  ["bidi: RLM", "\u200F"],
  ["bidi: ALM", "\u061C"],
];

describe("text visible to others: control, format and bidi characters (T-060 AC1, TH-29)", () => {
  for (const [field, errorOf] of FIELDS) {
    for (const [kind, char] of FORBIDDEN) {
      it(`${field}: rejects ${kind} inside the text`, () => {
        expect(errorOf(`Mle${char}ko`)).toBe("invalid");
      });
    }
  }

  it("rejects the impersonation example from TH-29 (RLO in a name)", () => {
    expect(errorsOf(signUpRequestSchema, { ...SIGN_UP, name: "Ania\u202Egnp.exe" })).toEqual({
      name: "invalid",
    });
  });

  for (const [field, errorOf] of FIELDS) {
    it(`${field}: accepts Polish letters, plain spaces and the decomposed form`, () => {
      expect(errorOf("Żółty ser")).toBeUndefined();
      expect(errorOf("Ząb łoś źdźbło")).toBeUndefined();
      expect(errorOf("Żółty ser")).toBeUndefined();
    });
  }

  it("accepts a new line in a note, and not in a name", () => {
    expect(errorsOf(createItemRequestSchema, { name: "a", note: "2 l\nbez laktozy" })).toEqual({});
    expect(errorsOf(updateItemRequestSchema, { note: "2 l\nbez laktozy" })).toEqual({});
    expect(errorsOf(createItemRequestSchema, { name: "Mle\nko" })).toEqual({ name: "invalid" });
    expect(errorsOf(listNameRequestSchema, { name: "Mle\nko" })).toEqual({ name: "invalid" });
  });
});

describe("text visible to others: at least one visible character (T-060 AC2, TH-29)", () => {
  const REQUIRED = FIELDS.filter(([field]) => !field.startsWith("note"));
  const INVISIBLE: [string, string][] = [
    ["Hangul filler U+3164", "\u3164"],
    ["half-width Hangul filler U+FFA0", "\uFFA0"],
    ["Braille blank U+2800", "\u2800"],
    ["combining marks only", "\u0301\u0308"],
    ["variation selector only", "\uFE0F"],
    ["Hangul filler between spaces", " \u3164 \u3164 "],
  ];

  for (const [field, errorOf] of REQUIRED) {
    for (const [kind, text] of INVISIBLE) {
      it(`${field}: rejects ${kind}`, () => {
        expect(errorOf(text)).toBe("invalid");
      });
    }
  }

  it("rejects an invisible padding character next to visible text", () => {
    expect(errorsOf(listNameRequestSchema, { name: "Ania\u3164" })).toEqual({ name: "invalid" });
    expect(errorsOf(listNameRequestSchema, { name: "Mleko\uFE0F" })).toEqual({ name: "invalid" });
  });

  for (const [field, errorOf] of FIELDS) {
    it(`${field}: accepts emoji, also joined with ZWJ, with a skin tone, a flag or a keycap`, () => {
      expect(errorOf("\u{1F95B}")).toBeUndefined();
      expect(errorOf("Rodzina \u{1F468}\u200D\u{1F469}\u200D\u{1F467}")).toBeUndefined();
      expect(errorOf("\u{1F469}\u{1F3FD}\u200D\u{1F373} kucharka")).toBeUndefined();
      expect(errorOf("\u2764\uFE0F Zakupy")).toBeUndefined();
      expect(errorOf("\u{1F3F3}\uFE0F\u200D\u{1F308}")).toBeUndefined();
      expect(errorOf("\u{1F1F5}\u{1F1F1} Polska")).toBeUndefined();
      expect(
        errorOf("\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}"),
      ).toBeUndefined();
      expect(errorOf("1\uFE0F\u20E3 pierwsza")).toBeUndefined();
    });

    it(`${field}: rejects ZWJ and the variation selector outside an emoji sequence`, () => {
      expect(errorOf("Mleko\u200D")).toBe("invalid");
      expect(errorOf("Mle\u200Dko")).toBe("invalid");
      expect(errorOf("\u{1F95B}\u200Dmleko")).toBe("invalid");
      expect(errorOf("a\uFE0Fb")).toBe("invalid");
    });
  }
});
