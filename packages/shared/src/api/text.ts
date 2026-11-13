import { z } from "zod";

// PostgreSQL nie zapisze NUL w kolumnie tekstowej; bez tego INSERT kończy się 500.
export const withoutNul = (text: string) => !text.includes("\u0000");

// TH-29: znaki sterujące (Cc), formatujące (Cf, w tym wszystkie znaki zmiany kierunku tekstu)
// i domyślnie ignorowane (wypełniacze, selektory wariantu) pozwalają podszyć się pod kogoś,
// ukryć część nazwy przed innymi albo zrobić nazwę pustą wizualnie. T-121: także Co, Cn i pojedyncze
// surogaty, każdy odstęp poza U+0020 (separatory linii łamią wiersz), pusty brajl i więcej niż
// 3 znaki łączące z rzędu (decyzja właściciela 2026-11-13).
const HIDDEN_CHARACTER =
  /[\p{C}\p{Default_Ignorable_Code_Point}\u{2800}]|(?! )\p{White_Space}|\p{M}{4}/u;

// Zamknięta lista wyjątków tylko wewnątrz emoji; żaden wzorzec nie dopuszcza dowolnej liczby
// znaków Cf (backend.md, „Pułapki”, T-073). ZWJ między obrazkami (👨‍👩‍👧, 👩🏽‍🍳, 🏳️‍🌈), jeden
// selektor wariantu po obrazku (❤️, ❤︎) i w keycapie (1️⃣) oraz trzy flagi RGI z tagami jako
// dokładne ciągi: Anglia, Szkocja, Walia (decyzja właściciela 2026-11-02).
const EMOJI_PART = new RegExp(
  [
    String.raw`(?<=\p{Extended_Pictographic}\p{Emoji_Modifier}?\u{FE0F}?)\u{200D}(?=\p{Extended_Pictographic})`,
    String.raw`(?<=\p{Extended_Pictographic}\p{Emoji_Modifier}?)[\u{FE0E}\u{FE0F}]`,
    String.raw`(?<=[#*0-9])\u{FE0F}(?=\u{20E3})`,
    String.raw`(?<=\u{1F3F4})\u{E0067}\u{E0062}(?:\u{E0065}\u{E006E}\u{E0067}|\u{E0073}\u{E0063}\u{E0074}|\u{E0077}\u{E006C}\u{E0073})\u{E007F}`,
  ].join("|"),
  "gu",
);

// Widoczny znak: nie odstęp, nie znak łączący (sam nic nie rysuje), nie ukryty, nie pusty brajl.
const VISIBLE_CHARACTER = /[^\p{White_Space}\p{M}\p{C}\p{Default_Ignorable_Code_Point}\u{2800}]/u;

/** Tekst widoczny dla innych bez ukrytych znaków; notatka może mieć `\n`. */
function withoutHiddenCharacters(allowNewLine: boolean) {
  return (text: string) => {
    const checked = text.replace(EMOJI_PART, "");
    return !HIDDEN_CHARACTER.test(allowNewLine ? checked.replaceAll("\n", "") : checked);
  };
}

// NBSP wpada przy wklejaniu z przeglądarki; zamieniona, nie odrzucona (decyzja właściciela 2026-11-13).
const withPlainSpaces = (text: string) => text.replaceAll(" ", " ");

const hasVisibleCharacter = (text: string) => VISIBLE_CHARACTER.test(text);

/**
 * Wymagana nazwa widoczna dla innych (imię, nazwa listy, pozycji): obcięte brzegi, 1–`max` znaków,
 * bez ukrytych znaków, z co najmniej jednym widocznym (TH-29).
 */
export function requiredName(max: number) {
  return z
    .string({ error: "required" })
    .overwrite(withPlainSpaces)
    .trim()
    .min(1, { error: "required" })
    .max(max, { error: "too_long" })
    .refine(withoutHiddenCharacters(false), { error: "invalid" })
    .refine(hasVisibleCharacter, { error: "invalid" });
}

/** Notatka widoczna dla innych (do `max` znaków): może być pusta i mieć nową linię (TH-29). */
export function optionalNote(max: number) {
  return z
    .string({ error: "invalid" })
    .overwrite(withPlainSpaces)
    .trim()
    .max(max, { error: "too_long" })
    .refine(withoutHiddenCharacters(true), { error: "invalid" })
    .refine((text) => text === "" || hasVisibleCharacter(text), { error: "invalid" });
}
