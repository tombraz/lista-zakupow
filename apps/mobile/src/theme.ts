import {
  ColorBgDefault,
  ColorTextPrimary,
  ColorTextSecondary,
  SpacingLg,
  SpacingMd,
  SpacingXl,
  TypographyLineHeightBase,
  TypographyLineHeightTight,
  TypographySizeBody,
  TypographySizeTitleLg,
  TypographyWeightBold,
} from "@lista/tokens/tokens";

/** Tokeny mają jednostki CSS („24px”); React Native przyjmuje liczby (dp). */
function dp(value: string): number {
  return Number.parseFloat(value);
}

/** Jedyne źródło wartości wyglądu w aplikacji: `tokens.ts` (layers/mobile.md, „Konwencje”). */
export const theme = {
  color: {
    bgDefault: ColorBgDefault,
    textPrimary: ColorTextPrimary,
    textSecondary: ColorTextSecondary,
  },
  spacing: { md: dp(SpacingMd), lg: dp(SpacingLg), xl: dp(SpacingXl) },
  font: {
    titleLg: dp(TypographySizeTitleLg),
    body: dp(TypographySizeBody),
    weightBold: String(TypographyWeightBold) as "700",
  },
  lineHeight: {
    titleLg: dp(TypographySizeTitleLg) * TypographyLineHeightTight,
    body: dp(TypographySizeBody) * TypographyLineHeightBase,
  },
} as const;
