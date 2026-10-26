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
    platforms: {
      css: {
        transformGroup: "css",
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
