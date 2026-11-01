import { z } from "zod";

// PostgreSQL nie zapisze NUL w kolumnie tekstowej; bez tego INSERT kończy się 500.
export const withoutNul = (text: string) => !text.includes("\u0000");

// TH-29: znaki sterujące (Cc), formatujące (Cf, w tym wszystkie znaki zmiany kierunku tekstu)
// i domyślnie ignorowane (wypełniacze, selektory wariantu) pozwalają podszyć się pod kogoś,
// ukryć część nazwy przed innymi albo zrobić nazwę pustą wizualnie.
const HIDDEN_CHARACTER = /[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}]/u;

// Wyjątki tylko wewnątrz emoji: ZWJ między obrazkami (👨‍👩‍👧, 👩🏽‍🍳, 🏳️‍🌈), selektor wariantu
// po obrazku (❤️) i w keycapie (1️⃣), znaczniki flag regionów (🏴 + tagi).
const EMOJI_PART = new RegExp(
  [
    String.raw`(?<=\p{Extended_Pictographic}[\u{FE0F}\p{Emoji_Modifier}]*)\u{200D}(?=\p{Extended_Pictographic})`,
    String.raw`(?<=\p{Extended_Pictographic}\p{Emoji_Modifier}?)[\u{FE0E}\u{FE0F}]`,
    String.raw`(?<=[#*0-9])\u{FE0F}(?=\u{20E3})`,
    String.raw`(?<=\u{1F3F4}[\u{E0020}-\u{E007E}]*)[\u{E0020}-\u{E007F}]`,
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

const hasVisibleCharacter = (text: string) => VISIBLE_CHARACTER.test(text);

/**
 * Wymagana nazwa widoczna dla innych (imię, nazwa listy, pozycji): obcięte brzegi, 1–`max` znaków,
 * bez ukrytych znaków, z co najmniej jednym widocznym (TH-29).
 */
export function requiredName(max: number) {
  return z
    .string({ error: "required" })
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
    .trim()
    .max(max, { error: "too_long" })
    .refine(withoutHiddenCharacters(true), { error: "invalid" });
}
