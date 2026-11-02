import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  createItemRequestSchema,
  fieldErrors,
  listNameRequestSchema,
  nameChangeRequestSchema,
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
  ["name (change)", (text) => errorsOf(nameChangeRequestSchema, { name: text }).name],
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

/** 🏴 i znaki tagów (U+E0000 + kod ASCII), np. `flag("gbeng")` to flaga Anglii. */
const BLACK_FLAG = "\u{1F3F4}";
const CANCEL_TAG = "\u{E007F}";
const tags = (ascii: string) =>
  Array.from(ascii, (letter) => String.fromCodePoint(0xe0000 + letter.charCodeAt(0))).join("");
const flag = (region: string) => BLACK_FLAG + tags(region) + CANCEL_TAG;

// T-073 AC1, AC2 (decyzja właściciela 2026-11-02): z sekwencji tagów tylko trzy flagi RGI.
describe("text visible to others: tag sequences after the black flag (T-073, TH-29)", () => {
  const REFUSED: [string, string][] = [
    ["hidden ASCII text after 🏴", `Ania ${BLACK_FLAG}${tags("secret text")}`],
    ["hidden text ending with the cancel tag", `Ania ${BLACK_FLAG}${tags("secret")}${CANCEL_TAG}`],
    ["England without the cancel tag", `${BLACK_FLAG}${tags("gbeng")}`],
    ["more than six tags", `${BLACK_FLAG}${tags("gbengland")}${CANCEL_TAG}`],
    ["an unknown region gbzzz", flag("gbzzz")],
    ["an unlisted subdivision plwp", flag("plwp")],
    ["the cancel tag alone after 🏴", `${BLACK_FLAG}${CANCEL_TAG}`],
    ["the cancel tag without 🏴", `Mleko${CANCEL_TAG}`],
    ["tags without 🏴", `Mleko${tags("gbeng")}${CANCEL_TAG}`],
    ["a tag after a valid flag", `${flag("gbeng")}${tags("x")}`],
    ["a second cancel tag after a valid flag", `${flag("gbsct")}${CANCEL_TAG}`],
    ["a flag followed by ZWJ", `${flag("gbwls")}‍\u{1F308}`],
    ["upper-case tags of England", flag("GBENG")],
    ["🏴 with VS16 before the tags", `${BLACK_FLAG}️${tags("gbeng")}${CANCEL_TAG}`],
  ];

  for (const [field, errorOf] of FIELDS) {
    for (const [kind, text] of REFUSED) {
      it(`${field}: rejects ${kind}`, () => {
        expect(errorOf(text)).toBe("invalid");
      });
    }

    it(`${field}: accepts the flags of England, Scotland and Wales`, () => {
      expect(errorOf(`${flag("gbeng")} Anglia`)).toBeUndefined();
      expect(errorOf(flag("gbsct"))).toBeUndefined();
      expect(errorOf(`Walia ${flag("gbwls")}`)).toBeUndefined();
      expect(errorOf(`${flag("gbeng")}${flag("gbsct")}`)).toBeUndefined();
    });

    it(`${field}: accepts 🏴 alone and at the end of the text`, () => {
      expect(errorOf(BLACK_FLAG)).toBeUndefined();
      expect(errorOf(`Piraci ${BLACK_FLAG}`)).toBeUndefined();
    });
  }
});

// T-073 AC3 (decyzja właściciela 2026-11-02): VS15 zaraz po emoji i VS16 w keycapie, po jednym.
describe("text visible to others: variation selectors (T-073 AC3, TH-29)", () => {
  for (const [field, errorOf] of FIELDS) {
    it(`${field}: accepts VS15 right after an emoji and VS16 in a keycap`, () => {
      expect(errorOf("❤︎ Zakupy")).toBeUndefined();
      expect(errorOf("1️⃣ pierwsza")).toBeUndefined();
      expect(errorOf("#️⃣")).toBeUndefined();
    });

    it(`${field}: rejects two variation selectors in a row or one without an emoji`, () => {
      expect(errorOf("❤️️")).toBe("invalid");
      expect(errorOf("❤︎️")).toBe("invalid");
      expect(errorOf("❤️︎")).toBe("invalid");
      expect(errorOf("1️️⃣")).toBe("invalid");
      expect(errorOf("Mleko︎")).toBe("invalid");
      expect(errorOf("︎ mleko")).toBe("invalid");
    });
  }
});

// T-073 AC4: test własności zamkniętej listy wyjątków (backend.md, „Pułapki”). Jedyny zatwierdzony
// znak Cf to ZWJ między dwoma obrazkami; każdy inny, w każdym miejscu, daje `invalid`.
describe("text visible to others: every format character outside the approved list (T-073 AC4, TH-29)", () => {
  const FORMAT_CHARACTERS: string[] = [];
  for (let codePoint = 0; codePoint <= 0x10ffff; codePoint++) {
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) continue;
    const char = String.fromCodePoint(codePoint);
    if (/\p{Cf}/u.test(char)) FORMAT_CHARACTERS.push(char);
  }

  // Miejsca, w których żaden znak Cf (także ZWJ) nie jest zatwierdzony; obejmują sąsiedztwo każdego
  // wyjątku z `EMOJI_PART`: obrazek, kolor skóry, selektor wariantu, keycap, ZWJ, 🏴 i flagę.
  const PLACES: [string, (char: string) => string][] = [
    ["at the start", (c) => `${c}Mleko`],
    ["inside a word", (c) => `Mle${c}ko`],
    ["at the end", (c) => `Mleko${c}`],
    ["right after an emoji", (c) => `\u{1F95B}${c} mleko`],
    ["after an emoji with a skin tone", (c) => `\u{1F469}\u{1F3FD}${c} kucharka`],
    ["after an emoji with VS16", (c) => `❤️${c} Zakupy`],
    ["after an emoji with VS15", (c) => `❤︎${c} Zakupy`],
    ["inside a keycap", (c) => `1️${c}⃣`],
    ["after a keycap", (c) => `1️⃣${c}`],
    ["after a ZWJ sequence", (c) => `\u{1F468}‍\u{1F469}${c} rodzina`],
    ["right after 🏴", (c) => `${BLACK_FLAG}${c} Ania`],
    [
      "inside the tags of a flag",
      (c) => `${BLACK_FLAG}${tags("gb")}${c}${tags("eng")}${CANCEL_TAG}`,
    ],
    ["right after a flag", (c) => `${flag("gbeng")}${c} Anglia`],
  ];

  it("finds the format characters to check", () => {
    expect(FORMAT_CHARACTERS.length).toBeGreaterThan(150);
    expect(FORMAT_CHARACTERS).toContain("‍");
    expect(FORMAT_CHARACTERS).toContain(CANCEL_TAG);
  });

  for (const [field, errorOf] of FIELDS) {
    it(`${field}: rejects every format character in every place`, () => {
      // `trim()` usuwa U+FEFF z brzegów przed zapisem (odstęp w JS), więc ten znak nie zostaje.
      const removedByTrim = (text: string, char: string) => !text.trim().includes(char);
      const accepted = PLACES.flatMap(([place, insert]) =>
        FORMAT_CHARACTERS.filter(
          (char) => errorOf(insert(char)) !== "invalid" && !removedByTrim(insert(char), char),
        ).map((char) => `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase()} ${place}`),
      );
      expect(accepted).toEqual([]);
    });
  }
});
