import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTokens } from "../src/build";

const source = fileURLToPath(new URL("../../../docs/design/tokens.json", import.meta.url));

describe("buildTokens (AC8)", () => {
  let outDir: string;
  let css: string;
  let ts: string;

  beforeAll(async () => {
    outDir = await mkdtemp(join(tmpdir(), "tokens-"));
    await buildTokens({ source, outDir });
    css = await readFile(join(outDir, "tokens.css"), "utf8");
    ts = await readFile(join(outDir, "tokens.ts"), "utf8");
  });

  afterAll(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  it("writes CSS custom properties on :root with values from tokens.json", () => {
    expect(css).toContain(":root {");
    expect(css).toContain("--color-text-primary: #0f172a;");
    expect(css).toContain("--color-surface-brand: #0b4fbf;");
    expect(css).toContain("--spacing-lg: 16px;");
    expect(css).toContain("--size-target-min: 48px;");
  });

  it("writes typography sizes in rem so they follow the browser text size (T-016 AC1)", () => {
    const sizes = [...css.matchAll(/--typography-size-[\w-]+: ([^;]+);/g)].map((m) => m[1]);
    expect(sizes).toEqual(["1.5rem", "1.25rem", "1.125rem", "1rem", "0.875rem"]);
    expect(css).toContain("--typography-size-body: 1rem;");
    expect(css).toContain("--spacing-lg: 16px;");
  });

  it("writes TypeScript constants for mobile with the same values", () => {
    expect(ts).toContain('export const ColorTextPrimary = "#0f172a";');
    expect(ts).toContain('export const SpacingLg = "16px";');
    expect(ts).toContain('export const TypographySizeBody = "16px";');
  });
});
