import StyleDictionary from "style-dictionary";

export interface BuildTokensOptions {
  source: string;
  outDir: string;
}

/** docs/design/tokens.json (W3C) → tokens.css (web) i tokens.ts (mobile). */
export async function buildTokens({ source, outDir }: BuildTokensOptions): Promise<void> {
  const dictionary = new StyleDictionary({
    source: [source],
    log: { verbosity: "silent" },
    hooks: {
      transforms: {
        // Rozmiary tekstu w rem, żeby szły za rozmiarem tekstu przeglądarki (design-system.md, WCAG 1.4.4).
        "typography-size/pxToRem": {
          type: "value",
          filter: (token) => token.path[0] === "typography" && token.path[1] === "size",
          transform: (token) =>
            `${String(parseFloat(String(token.$value ?? token.value)) / 16)}rem`,
        },
      },
    },
    platforms: {
      css: {
        transformGroup: "css",
        transforms: ["typography-size/pxToRem"],
        buildPath: `${outDir}/`,
        files: [{ destination: "tokens.css", format: "css/variables" }],
      },
      ts: {
        transformGroup: "js",
        buildPath: `${outDir}/`,
        files: [{ destination: "tokens.ts", format: "javascript/es6" }],
      },
    },
  });
  await dictionary.buildAllPlatforms();
}
