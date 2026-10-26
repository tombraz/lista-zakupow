#!/usr/bin/env node
// design-check: keeps the design in the repo consistent and the code honest about it.
//
// Usage:
//   node scripts/design-check.mjs                       # tokens + screen coverage
//   node scripts/design-check.mjs --scan src apps/web   # also: hard-coded colours in UI code
//   node scripts/design-check.mjs --scan src --allow src/theme/tokens   # skip generated token files
//   node scripts/design-check.mjs --design <dir>        # design dir (default docs/design)
//
// Checks:
//   1. tokens.json is valid W3C design-tokens JSON ($value / $type), with colour, typography
//      and spacing groups; tokens.dark.json (if present) defines the same colour names.
//   2. Token names describe a role (color.text.primary), not a value (blue-500).
//   2b. Contrast: every row of the "Contrast pairs" table in design-system.md
//      (| Foreground | Background | Use |, Use = text | large-text | ui) is computed with the WCAG
//      formula for the light theme (tokens.json) and the dark theme (tokens.dark.json):
//      AA: text 4.5, large-text 3, ui 3; AAA (when design-decisions.md names AAA): text 7, large-text 4.5.
//   3. Every screen in ia.md has a spec docs/design/screens/SC-xx-*.md; when
//      design-decisions.md says "design_tool: claude-design", every spec has a "design:" link.
//   4. --scan: colour literals (#hex, rgb(), hsl(), 0xFFxxxxxx) in UI source files. Code must use
//      tokens. Files whose path contains an --allow value are skipped (generated token output);
//      a line containing "design-check-ignore" is skipped.
//
// Exit code 1 on errors or hard-coded colours. No dependencies: plain Node 18+.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, extname } from "node:path";

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const DESIGN = opt("--design", "docs/design");
const many = (name) => {
  const out = []; let on = false;
  for (const a of args) { if (a.startsWith("--")) { on = a === name; continue; } if (on) out.push(a); }
  return out;
};
const scanDirs = many("--scan");
const allow = many("--allow");
const errors = [], warnings = [];

// 1–2. Tokens
function leaves(obj, path = [], out = []) {
  if (obj && typeof obj === "object" && "$value" in obj) { out.push({ name: path.join("."), value: obj.$value }); return out; }
  if (obj && typeof obj === "object") for (const [k, v] of Object.entries(obj)) if (!k.startsWith("$")) leaves(v, [...path, k], out);
  return out;
}
function load(file) {
  try { return JSON.parse(readFileSync(file, "utf8")); }
  catch (e) { errors.push(`${file}: not valid JSON (${e.message})`); return null; }
}
const tokensFile = join(DESIGN, "tokens.json");
let tokens = [], darkTokens = [];
if (!existsSync(tokensFile)) warnings.push(`${tokensFile} not found (written in /brd-to-design Step 4 or by the import)`);
else {
  const json = load(tokensFile);
  if (json) {
    tokens = leaves(json);
    if (!tokens.length) errors.push(`${tokensFile}: no tokens with "$value" (use the W3C design-tokens format)`);
    const top = new Set(tokens.map((t) => t.name.split(".")[0]));
    for (const [group, alts] of [["color", ["color", "colour", "colors"]], ["typography", ["typography", "font", "fontSize", "text"]], ["spacing", ["spacing", "space", "size"]]])
      if (!alts.some((a) => top.has(a))) warnings.push(`${tokensFile}: no ${group} group found`);
    const valueNamed = /(^|[.-])(red|blue|green|yellow|orange|purple|pink|gray|grey|slate|zinc|neutral|teal|cyan|indigo|violet)[-_]?\d{2,3}$/i;
    for (const t of tokens) if (valueNamed.test(t.name)) warnings.push(`${tokensFile}: "${t.name}" is named by value; name tokens by role (e.g. color.action.primary). Palette tokens are fine if components only use role tokens that reference them.`);
  }
  const darkFile = join(DESIGN, "tokens.dark.json");
  if (existsSync(darkFile)) {
    const dark = load(darkFile);
    if (dark) {
      const isColour = (n) => /^(color|colour|colors)\./.test(n);
      const light = new Set(tokens.map((t) => t.name).filter(isColour));
      darkTokens = leaves(dark);
      const darkNames = new Set(darkTokens.map((t) => t.name));
      for (const n of light) if (!darkNames.has(n)) errors.push(`${darkFile}: missing dark value for ${n}`);
      for (const n of darkNames) if (!light.has(n)) errors.push(`${darkFile}: ${n} does not exist in tokens.json`);
    }
  }
}

// 2b. Contrast pairs
function parseColour(v) {
  // returns { r, g, b, a } with r,g,b in 0..255, or null
  if (v && typeof v === "object") {
    if (typeof v.hex === "string" && (!v.colorSpace || v.colorSpace === "srgb")) {
      const c = parseColour(v.hex); if (c && typeof v.alpha === "number") c.a = v.alpha; return c;
    }
    if (v.colorSpace === "srgb" && Array.isArray(v.components))
      return { r: v.components[0] * 255, g: v.components[1] * 255, b: v.components[2] * 255, a: typeof v.alpha === "number" ? v.alpha : 1 };
    return null;
  }
  if (typeof v !== "string") return null;
  const s = v.trim();
  let m = s.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join("");
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: +m[1], g: +m[2], b: +m[3], a };
  }
  return null;
}
function resolver(list) {
  const map = new Map(list.map((t) => [t.name, t.value]));
  const get = (name, depth = 0) => {
    const v = map.get(name);
    if (depth > 10) return undefined;
    if (typeof v === "string" && /^\{.+\}$/.test(v.trim())) return get(v.trim().slice(1, -1), depth + 1);
    return v;
  };
  return { has: (n) => map.has(n), get };
}
const lum = ({ r, g, b }) => {
  const ch = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};
const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const dsFile = join(DESIGN, "design-system.md");
const decisionsFile = join(DESIGN, "design-decisions.md");
const aaa = existsSync(decisionsFile) && /WCAG[^\n]*\bAAA\b/i.test(readFileSync(decisionsFile, "utf8"));
const MIN = aaa ? { text: 7, "large-text": 4.5, ui: 3 } : { text: 4.5, "large-text": 3, ui: 3 };
let pairsChecked = 0, contrastFails = 0;
if (tokens.length && existsSync(dsFile)) {
  const lines = readFileSync(dsFile, "utf8").split(/\r?\n/);
  const pairs = [];
  let inSec = false, cols = null;
  const cells = (l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim().replace(/[`*]/g, ""));
  for (const l of lines) {
    if (/^#{2,3}\s/.test(l)) { inSec = /^#{2,3}\s+contrast pairs\s*$/i.test(l); cols = null; continue; }
    if (!inSec || !l.trim().startsWith("|")) continue;
    const c = cells(l);
    if (!cols) { cols = { fg: c.findIndex((x) => /^foreground$/i.test(x)), bg: c.findIndex((x) => /^background$/i.test(x)), use: c.findIndex((x) => /^use$/i.test(x)) }; continue; }
    if (c.every((x) => /^:?-+:?$/.test(x))) continue;
    if (cols.fg < 0 || cols.bg < 0) break;
    const use = (cols.use >= 0 ? c[cols.use] : "text").toLowerCase();
    if (c[cols.fg] && !c[cols.fg].startsWith("<")) pairs.push({ fg: c[cols.fg], bg: c[cols.bg], use });
  }
  if (!pairs.length) warnings.push(`${dsFile}: no "## Contrast pairs" table (| Foreground | Background | Use |); contrast is not verified`);
  const themes = [["light", resolver(tokens)]];
  if (darkTokens.length) themes.push(["dark", resolver([...tokens, ...darkTokens])]);
  for (const p of pairs) {
    if (!MIN[p.use]) { errors.push(`${dsFile}: contrast pair ${p.fg} on ${p.bg}: Use "${p.use}" must be text, large-text or ui`); continue; }
    for (const [theme, R] of themes) {
      for (const n of [p.fg, p.bg]) if (!R.has(n)) errors.push(`${dsFile}: contrast pair uses unknown token ${n}`);
      if (!R.has(p.fg) || !R.has(p.bg)) break;
      const fg = parseColour(R.get(p.fg)), bg = parseColour(R.get(p.bg));
      if (!fg || !bg) { warnings.push(`contrast ${p.fg} on ${p.bg} (${theme}): colour format not computable (use hex, rgb() or srgb)`); continue; }
      if (bg.a < 1) { warnings.push(`contrast ${p.fg} on ${p.bg} (${theme}): background is transparent; list the pair against the opaque surface beneath`); continue; }
      const r = ratio(fg.a < 1 ? over(fg, bg) : fg, bg);
      pairsChecked++;
      if (r + 1e-9 < MIN[p.use]) { contrastFails++; errors.push(`contrast ${p.fg} on ${p.bg} (${theme}, ${p.use}): ${r.toFixed(2)}:1, needs ${MIN[p.use]}:1 (WCAG ${aaa ? "AAA" : "AA"})`); }
      else console.log(`contrast ${theme.padEnd(5)} ${r.toFixed(2).padStart(5)}:1  ${p.fg} on ${p.bg} (${p.use})`);
    }
  }
}

// 3. Screen coverage
const iaFile = join(DESIGN, "ia.md");
if (existsSync(iaFile)) {
  const ids = [...new Set([...readFileSync(iaFile, "utf8").matchAll(/^\|\s*`?(SC-\d+)`?\s*\|/gm)].map((m) => m[1]))];
  const screensDir = join(DESIGN, "screens");
  const specs = existsSync(screensDir) ? readdirSync(screensDir).filter((f) => f.endsWith(".md")) : [];
  const decisions = join(DESIGN, "design-decisions.md");
  const claudeDesign = existsSync(decisions) && /^\s*-?\s*\**design_tool\**:?\**\s*:?\s*`?claude-design/im.test(readFileSync(decisions, "utf8"));
  for (const id of ids) {
    const spec = specs.find((f) => f.startsWith(id + "-"));
    if (!spec) { warnings.push(`${id}: no screen spec in ${screensDir}/ (written in /brd-to-design Step 5)`); continue; }
    if (claudeDesign) {
      const fm = readFileSync(join(screensDir, spec), "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
      const link = (fm.match(/^design:[ \t]*(.*)$/m)?.[1] ?? "").replace(/^#.*$|\s+#.*$/, "").trim();
      if (!link) errors.push(`${screensDir}/${spec}: "design:" is empty; link the screen's artboard in the Claude Design artifact`);
    }
  }
}

// 4. Hard-coded colours
const UI_EXT = new Set([".css", ".scss", ".sass", ".less", ".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte", ".astro", ".html", ".kt", ".swift", ".dart", ".xml"]);
const SKIP_DIR = new Set(["node_modules", ".git", "dist", "build", ".next", ".nuxt", "out", "coverage", "Pods", ".gradle", "vendor"]);
const COLOUR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:rgba?|hsla?)\(\s*\d|\b0x[fF]{2}[0-9a-fA-F]{6}\b/;
let hits = 0;
function scan(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!SKIP_DIR.has(name)) scan(p); continue; }
    if (!UI_EXT.has(extname(name))) continue;
    const rel = relative(process.cwd(), p);
    if (allow.some((a) => rel.includes(a)) || /\.(test|spec)\.|__tests__|\.stories\./.test(rel)) continue;
    readFileSync(p, "utf8").split(/\r?\n/).forEach((line, i) => {
      if (line.includes("design-check-ignore")) return;
      const code = line.replace(/\/\/.*$|\/\*.*?\*\//g, "");
      // "#abc" in a URL fragment or an id selector is not a colour; require a colour-like context
      const m = code.match(COLOUR);
      if (!m) return;
      if (m[0].startsWith("#") && /href|url\(|id=|getElementById|querySelector/.test(code)) return;
      hits++;
      if (hits <= 200) console.log(`HARD-CODED ${rel}:${i + 1}  ${m[0]}  → use a token`);
    });
  }
}
for (const d of scanDirs) existsSync(d) ? scan(d) : warnings.push(`--scan: ${d} not found`);
if (hits > 200) console.log(`… and ${hits - 200} more`);

console.log(`Tokens: ${tokens.length}  Contrast checks: ${pairsChecked} (${contrastFails} failing, WCAG ${aaa ? "AAA" : "AA"})${scanDirs.length ? `  Hard-coded colours: ${hits}` : ""}`);
for (const w of warnings) console.log(`WARN  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
if (!errors.length && !hits) console.log("OK: no errors");
process.exit(errors.length || hits ? 1 : 0);
