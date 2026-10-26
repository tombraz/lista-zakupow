#!/usr/bin/env node
// backlog-check: validates docs/backlog task files and reports the frontier.
//
// Usage:
//   node scripts/backlog-check.mjs                # validate + summary + frontier
//   node scripts/backlog-check.mjs --next         # print only tasks ready to start
//   node scripts/backlog-check.mjs --write-index  # regenerate docs/backlog/index.md
//   node scripts/backlog-check.mjs --json         # machine-readable output
//   node scripts/backlog-check.mjs --summary      # compact JSON state for an orchestrator
//   node scripts/backlog-check.mjs --summary --epic E-01   # same, one epic only
//   node scripts/backlog-check.mjs --board        # also write docs/backlog/board.html (combine with any mode)
//   node scripts/backlog-check.mjs --board --lang pl   # board labels in Polish (en default)
//   node scripts/backlog-check.mjs --root <dir>   # backlog dir (default docs/backlog)
//   node scripts/backlog-check.mjs --layers <dir> # layer guides dir (default docs/architecture/layers)
//   node scripts/backlog-check.mjs --threats <file> # threat model (default docs/architecture/threat-model.md)
//
// Exit code 1 when errors are found (missing dependency, cycle, bad status...).
// No dependencies: runs on plain Node 18+.

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, basename, dirname, resolve } from "node:path";

const STATUSES = ["todo", "in-progress", "in-qa", "done", "blocked"];
const STORY_STATUSES = ["todo", "in-progress", "done"];
const EPIC_STATUSES = ["todo", "in-progress", "in-uat", "done"];
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const rootIdx = args.indexOf("--root");
const ROOT = rootIdx >= 0 ? args[rootIdx + 1] : "docs/backlog";
const layersIdx = args.indexOf("--layers");
const LAYERS_DIR = layersIdx >= 0 ? args[layersIdx + 1] : "docs/architecture/layers";
const threatIdx = args.indexOf("--threats");
const THREAT_MODEL = threatIdx >= 0 ? args[threatIdx + 1] : "docs/architecture/threat-model.md";

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

// Minimal frontmatter parser for flat "key: value" and inline "key: [a, b]" lines.
// A quoted value ("..." or '...') may contain " #"; otherwise " #" starts a comment.
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const data = {};
  for (const raw of m[1].split(/\r?\n/)) {
    const kv = raw.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let [, key, value] = kv;
    value = value.trim();
    const quoted = value.match(/^(["'])(.*?)\1/);
    if (quoted) { data[key] = quoted[2]; continue; }
    value = value.replace(/\s+#.*$/, "").replace(/^#.*$/, "").trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      data[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      data[key] = value.replace(/^["']|["']$/g, "");
    }
  }
  return data;
}

if (!existsSync(ROOT)) {
  console.error(`Backlog directory not found: ${ROOT}`);
  process.exit(1);
}

const errors = [];
const warnings = [];
const tasks = new Map();
const stories = new Map();
const epics = new Map();

for (const file of walk(ROOT)) {
  const name = basename(file);
  if (name === "index.md" || name === "tech-stack.md") continue;
  const text = readFileSync(file, "utf8");
  const fm = parseFrontmatter(text);
  const rel = relative(process.cwd(), file);
  if (name === "epic.md") {
    if (!fm?.id) { errors.push(`${rel}: epic without id in frontmatter`); continue; }
    if (fm.status && !EPIC_STATUSES.includes(fm.status))
      errors.push(`${rel}: epic status "${fm.status}" must be one of ${EPIC_STATUSES.join(", ")}`);
    epics.set(fm.id, { ...fm, file: rel, path: file, dir: dirname(file) });
    continue;
  }
  if (name === "story.md") {
    if (!fm?.id) { errors.push(`${rel}: story without id in frontmatter`); continue; }
    if (fm.status && !STORY_STATUSES.includes(fm.status))
      errors.push(`${rel}: story status "${fm.status}" must be one of ${STORY_STATUSES.join(", ")}`);
    stories.set(fm.id, { ...fm, file: rel, dir: dirname(file) });
    continue;
  }
  if (!name.startsWith("T-")) continue;
  if (!/^T-\d{3,}-/.test(name)) {
    errors.push(`${rel}: task file name must look like T-001-short-name.md (template placeholder left?)`);
    continue;
  }
  if (!fm) { errors.push(`${rel}: task file without frontmatter`); continue; }
  const isFix = fm.kind === "fix";
  if (fm.kind && !isFix) errors.push(`${rel}: kind "${fm.kind}" is unknown (only "fix" is allowed)`);
  if (isFix && basename(dirname(file)) !== "fixes") errors.push(`${rel}: fix tasks belong in ${ROOT}/fixes/`);
  if (!isFix && basename(dirname(file)) === "fixes") errors.push(`${rel}: file in fixes/ must have kind: fix`);
  for (const key of isFix ? ["id", "title", "status"] : ["id", "title", "epic", "story", "status"]) {
    if (!fm[key]) errors.push(`${rel}: missing "${key}"`);
  }
  if (!Array.isArray(fm.depends_on)) {
    errors.push(`${rel}: "depends_on" must be a list, e.g. depends_on: [] or [T-001]`);
    fm.depends_on = [];
  }
  if (fm.id && !/^T-\d{3,}$/.test(fm.id)) errors.push(`${rel}: id "${fm.id}" must look like T-001`);
  if (fm.id && !name.startsWith(fm.id + "-")) {
    errors.push(`${rel}: id ${fm.id} does not match file name`);
  }
  if (fm.status && !STATUSES.includes(fm.status)) {
    errors.push(`${rel}: status "${fm.status}" must be one of ${STATUSES.join(", ")}`);
  }
  if (tasks.has(fm.id)) {
    errors.push(`${rel}: duplicate id ${fm.id} (also in ${tasks.get(fm.id).file})`);
    continue;
  }
  // QA rounds: "## QA round N ..." headings, each followed by a "Verdict: pass|fail" line.
  const rounds = [...text.matchAll(/^## QA round (\d+)[\s\S]*?(?=^## QA round |(?![\s\S]))/gm)];
  const verdicts = rounds.map((r) => (r[0].match(/^\**Verdict:?\**:?\s*\**(pass|fail)/im) || [])[1]?.toLowerCase() ?? "unknown");
  if (verdicts.includes("unknown"))
    errors.push(`${rel}: a "## QA round" section has no "Verdict: pass" or "Verdict: fail" line`);
  // Open questions: the last "## Open question" section is unanswered if it has no "Answer:" line.
  const questions = [...text.matchAll(/^## Open question[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/gm)];
  const awaiting_user = questions.length > 0 && !/^\**Answer:?\**:?/im.test(questions.at(-1)[1]);
  const question = awaiting_user ? questions.at(-1)[1].trim().replace(/\s+/g, " ").slice(0, 400) : "";
  tasks.set(fm.id, { ...fm, file: rel, path: file, dir: dirname(file), qa_rounds: rounds.length, qa_last: verdicts.at(-1) ?? null, awaiting_user, question });
}

// References
for (const t of tasks.values()) {
  if (t.epic && epics.size && !epics.has(t.epic)) errors.push(`${t.file}: epic ${t.epic} not found`);
  if (t.story && stories.size && !stories.has(t.story)) errors.push(`${t.file}: story ${t.story} not found`);
  const st = stories.get(t.story);
  if (st && st.dir !== t.dir) errors.push(`${t.file}: story ${t.story} lives in another folder (${st.file})`);
  const ep = epics.get(t.epic);
  if (st && ep && dirname(st.dir) !== ep.dir) errors.push(`${t.file}: story ${t.story} is not inside epic ${t.epic}'s folder`);
  if (st && st.epic && t.epic && st.epic !== t.epic) errors.push(`${t.file}: epic ${t.epic} differs from its story's epic ${st.epic}`);
  for (const dep of t.depends_on) {
    if (dep === t.id) errors.push(`${t.file}: depends on itself`);
    else if (!tasks.has(dep)) errors.push(`${t.file}: depends on missing task ${dep}`);
  }
}

// Layers: every value in a task's "layers:" needs a guide docs/architecture/layers/<layer>.md
if (existsSync(LAYERS_DIR)) {
  const guides = new Set(readdirSync(LAYERS_DIR).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)));
  for (const t of tasks.values()) {
    for (const layer of Array.isArray(t.layers) ? t.layers : []) {
      if (!guides.has(layer)) errors.push(`${t.file}: layer "${layer}" has no guide (${LAYERS_DIR}/${layer}.md); known: ${[...guides].join(", ") || "none"}`);
    }
  }
} else if ([...tasks.values()].some((t) => Array.isArray(t.layers) && t.layers.length)) {
  warnings.push(`no layer guides found in ${LAYERS_DIR}; run /tech-architecture to create them`);
}
for (const t of tasks.values()) {
  if (!Array.isArray(t.layers) || !t.layers.length) warnings.push(`${t.file}: "layers" is empty`);
}

// Threats: every TH-xx a task lists must exist in the threat model;
// threats covered "by task" must be listed by at least one task.
if (existsSync(THREAT_MODEL)) {
  // Parse only the table under "## Threats"; find the "ID" and "Covered by" columns from its header row.
  const lines = readFileSync(THREAT_MODEL, "utf8").split(/\r?\n/);
  const known = new Map();
  let inThreats = false, idCol = -1, coveredCol = -1;
  const cellsOf = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  for (const line of lines) {
    if (/^##\s/.test(line)) { inThreats = /^##\s+Threats\s*$/i.test(line); idCol = coveredCol = -1; continue; }
    if (!inThreats || !line.trim().startsWith("|")) continue;
    const cells = cellsOf(line);
    if (idCol < 0) {
      idCol = cells.findIndex((c) => /^id$/i.test(c));
      coveredCol = cells.findIndex((c) => /^covered by$/i.test(c));
      continue;
    }
    const id = (cells[idCol] || "").replace(/[`*]/g, "");
    if (!/^TH-\d+$/.test(id)) continue;
    const raw = (coveredCol >= 0 ? cells[coveredCol] || "" : "").replace(/[`*]/g, "").replace(/\(.*?\)/g, "").trim().toLowerCase();
    known.set(id, /^(task|ci|accepted)$/.test(raw) ? raw : "");
  }
  if (!known.size) warnings.push(`${THREAT_MODEL}: no threats found under "## Threats" (table needs "ID" and "Covered by" columns)`);
  const listed = new Set();
  for (const t of tasks.values()) {
    for (const th of Array.isArray(t.threats) ? t.threats : []) {
      listed.add(th);
      if (!known.has(th)) errors.push(`${t.file}: threat ${th} not found in ${THREAT_MODEL}`);
    }
  }
  for (const [th, coveredBy] of known) {
    if (!coveredBy) warnings.push(`${THREAT_MODEL}: ${th} needs exactly one "Covered by" value: task, ci or accepted`);
    else if (coveredBy === "task" && !listed.has(th)) warnings.push(`threat ${th} is covered "by task" but no task lists it in threats:`);
  }
}

// Cycles (DFS with colours)
const colour = new Map();
const cycles = [];
function visit(id, stack) {
  colour.set(id, "grey");
  for (const dep of tasks.get(id)?.depends_on ?? []) {
    if (!tasks.has(dep)) continue;
    if (colour.get(dep) === "grey") {
      cycles.push([...stack.slice(stack.indexOf(dep)), dep].join(" -> "));
    } else if (!colour.has(dep)) visit(dep, [...stack, dep]);
  }
  colour.set(id, "black");
}
for (const id of tasks.keys()) if (!colour.has(id)) visit(id, [id]);
for (const c of cycles) errors.push(`dependency cycle: ${c}`);

// Status consistency
const isDone = (id) => tasks.get(id)?.status === "done";
for (const t of tasks.values()) {
  const open = t.depends_on.filter((d) => tasks.has(d) && !isDone(d));
  if ((t.status === "in-progress" || t.status === "in-qa") && open.length)
    errors.push(`${t.id} is ${t.status} but depends on unfinished ${open.join(", ")}`);
  if (t.status === "done" && open.length)
    warnings.push(`${t.id} is done but depends on unfinished ${open.join(", ")}`);
}

const byId = (a, b) => a.id.localeCompare(b.id, undefined, { numeric: true });
const all = [...tasks.values()].sort(byId);
const frontier = all.filter((t) => t.status === "todo" && t.depends_on.every(isDone));
const counts = Object.fromEntries(STATUSES.map((s) => [s, all.filter((t) => t.status === s).length]));

function mermaid() {
  const lines = ["flowchart LR"];
  const style = { done: ":::done", "in-progress": ":::wip", "in-qa": ":::qa", blocked: ":::blocked", todo: "" };
  for (const t of all) {
    const label = `${t.id}: ${t.title}`.replace(/"/g, "'");
    lines.push(`  ${t.id.replace(/-/g, "_")}["${label}"]${style[t.status] ?? ""}`);
  }
  for (const t of all)
    for (const d of t.depends_on)
      if (tasks.has(d)) lines.push(`  ${d.replace(/-/g, "_")} --> ${t.id.replace(/-/g, "_")}`);
  lines.push("  classDef done fill:#d1fadf,stroke:#12b76a");
  lines.push("  classDef wip fill:#fef0c7,stroke:#f79009");
  lines.push("  classDef qa fill:#e0eaff,stroke:#2970ff");
  lines.push("  classDef blocked fill:#fee4e2,stroke:#f04438");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// --board: self-contained HTML board (docs/backlog/board.html). No external
// libraries; works offline. Reads review verdicts from docs/reviews and
// docs/security/reviews (siblings of the backlog dir).
// ---------------------------------------------------------------------------
const I18N = {
  en: {
    title: "Backlog board", generated: "Generated", tasks: "tasks", epics: "Epics", board: "Board", graphs: "Dependencies",
    fixes: "Fix tasks", waiting: "Waiting for you", errors: "The backlog has errors", all: "All epics", fixesOpt: "Fix tasks",
    layers: "Layers", epic: "Epic", noTasks: "No tasks yet", noWaiting: "Nothing is waiting for you.", noFixes: "No fix tasks.",
    todo: "To do", "in-progress": "In progress", "in-qa": "In QA", blocked: "Blocked", done: "Done",
    ready: "ready to start", question: "question for you", qa: "QA", rounds: "rounds", last: "last",
    stBuild: "Build", stCode: "Code review", stSec: "Security review", stUat: "UAT", stDone: "Done", notStarted: "not started",
    codeReview: "Code review", secReview: "Security review", none: "none yet", next: "Next", answerHint: "Write the answer under the question as a line starting with “Answer:”, then run",
    uatHint: "Epic waits for your acceptance", external: "other epic", severity: "severity", type: "type", status: "Status", id: "ID", name: "Title",
    legend: "Legend", empty: "empty", clear: "Clear",
  },
  pl: {
    title: "Tablica backlogu", generated: "Wygenerowano", tasks: "tasków", epics: "Epiki", board: "Tablica", graphs: "Zależności",
    fixes: "Poprawki (/fix)", waiting: "Czeka na ciebie", errors: "Backlog ma błędy", all: "Wszystkie epiki", fixesOpt: "Poprawki",
    layers: "Warstwy", epic: "Epik", noTasks: "Brak tasków", noWaiting: "Nic na ciebie nie czeka.", noFixes: "Brak poprawek.",
    todo: "Do zrobienia", "in-progress": "W toku", "in-qa": "QA", blocked: "Zablokowane", done: "Gotowe",
    ready: "gotowy do startu", question: "pytanie do ciebie", qa: "QA", rounds: "rundy", last: "ostatnio",
    stBuild: "Budowa", stCode: "Przegląd kodu", stSec: "Przegląd bezpieczeństwa", stUat: "UAT", stDone: "Gotowe", notStarted: "nie rozpoczęty",
    codeReview: "Przegląd kodu", secReview: "Przegląd bezpieczeństwa", none: "jeszcze nie było", next: "Następny krok", answerHint: "Wpisz odpowiedź pod pytaniem w linii zaczynającej się od „Answer:”, potem uruchom",
    uatHint: "Epik czeka na twój odbiór", external: "inny epik", severity: "waga", type: "typ", status: "Status", id: "ID", name: "Tytuł",
    legend: "Legenda", empty: "pusto", clear: "Wyczyść",
  },
};

function latestReviews(dir) {
  // File names: <scope>-YYYY-MM-DD-N.md. Returns Map scope -> { file, date, n, verdict }.
  const out = new Map();
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const m = name.match(/^(.+)-(\d{4}-\d{2}-\d{2})(?:-(\d+))?\.md$/);
    if (!m) continue;
    const [, scope, date, n = "1"] = m;
    const prev = out.get(scope);
    const key = `${date}-${n.padStart(4, "0")}`;
    if (prev && prev.key >= key) continue;
    const text = readFileSync(join(dir, name), "utf8");
    const verdict = (text.match(/^\**Verdict:?\**:?\s*\**(pass|fail)/im) || [])[1]?.toLowerCase() ?? "unknown";
    out.set(scope, { file: join(dir, name), date, n: Number(n), key, verdict });
  }
  return out;
}

function writeBoard() {
  const langIdx = args.indexOf("--lang");
  const L = I18N[langIdx >= 0 ? args[langIdx + 1] : "en"] ?? I18N.en;
  const docs = dirname(ROOT);
  const codeReviews = latestReviews(join(docs, "reviews"));
  const secReviews = latestReviews(join(docs, "security", "reviews"));
  const hasThreatModel = existsSync(THREAT_MODEL);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const href = (p) => esc(relative(ROOT, p).split("\\").join("/"));
  const readySet = new Set(frontier.map((t) => t.id));
  const COLS = ["todo", "in-progress", "in-qa", "blocked", "done"];
  const list = (v) => (Array.isArray(v) ? v : []);
  const epicList = [...epics.values()].sort(byId);
  const fixes = all.filter((t) => t.kind === "fix");
  const allLayers = [...new Set(all.flatMap((t) => list(t.layers)))].sort();

  // Epic stage + next command
  function stageOf(e, ts) {
    const steps = [L.stBuild, L.stCode, ...(hasThreatModel ? [L.stSec] : []), L.stUat, L.stDone];
    const cr = codeReviews.get(e.id), sr = secReviews.get(e.id);
    let idx = -1, next = "";
    const started = ts.some((t) => t.status !== "todo");
    if (e.status === "done") idx = steps.length - 1;
    else if (e.status === "in-uat") {
      if (cr?.verdict !== "pass") { idx = 1; next = `/review-change ${e.id}`; }
      else if (hasThreatModel && sr?.verdict !== "pass") { idx = 2; next = `/security-review ${e.id}`; }
      else { idx = steps.length - 2; next = `/qa-task ${e.id}`; }
    } else if (e.status === "in-progress" || started) { idx = 0; next = `/build-epic ${e.id}`; }
    else next = e.approved ? `/build-epic ${e.id}` : "/plan-backlog";
    return { steps, idx, next, cr, sr };
  }

  const statusBar = (ts) => {
    const total = ts.length || 1;
    return `<div class="bar" role="img" aria-label="${COLS.map((s) => `${L[s]}: ${ts.filter((t) => t.status === s).length}`).join(", ")}">${["done", "in-qa", "in-progress", "blocked"]
      .map((s) => { const n = ts.filter((t) => t.status === s).length; return n ? `<span class="seg s-${s}" style="width:${(n / total) * 100}%" title="${esc(L[s])}: ${n}"></span>` : ""; }).join("")}</div>`;
  };
  const verdictChip = (label, r) => r
    ? `<a class="chip v-${esc(r.verdict)}" href="${href(r.file)}">${esc(label)}: <b>${esc(r.verdict)}</b> <span class="muted">${esc(r.date)}${r.n > 1 ? " #" + r.n : ""}</span></a>`
    : `<span class="chip v-none">${esc(label)}: <span class="muted">${esc(L.none)}</span></span>`;

  const epicCards = epicList.map((e) => {
    const ts = all.filter((t) => t.epic === e.id);
    const done = ts.filter((t) => t.status === "done").length;
    const st = stageOf(e, ts);
    const stepper = st.steps.map((s, i) => `<li class="${i < st.idx || (e.status === "done") ? "past" : i === st.idx ? "now" : ""}">${esc(s)}</li>`).join("");
    const waiting = ts.filter((t) => t.awaiting_user).length;
    return `<article class="epic" data-epic="${esc(e.id)}">
  <header><a class="eid" href="${href(e.path)}">${esc(e.id)}</a> <span class="etitle">${esc(e.title || "")}</span>
  <span class="count">${done}/${ts.length}</span></header>
  ${statusBar(ts)}
  <ol class="stepper${st.idx < 0 ? " idle" : ""}">${stepper}</ol>
  <div class="chips">${verdictChip(L.codeReview, st.cr)}${hasThreatModel ? verdictChip(L.secReview, st.sr) : ""}</div>
  ${st.next ? `<div class="next">${esc(L.next)}: <code>${esc(st.next)}</code>${waiting ? ` <span class="badge q">${waiting} × ${esc(L.question)}</span>` : ""}${e.status === "in-uat" && st.idx === st.steps.length - 2 ? ` <span class="muted">${esc(L.uatHint)}</span>` : ""}</div>` : ""}
</article>`;
  }).join("\n");

  const card = (t) => {
    const layers = list(t.layers);
    const qa = t.qa_rounds ? `<span class="badge qa-${esc(t.qa_last)}">${esc(L.qa)} ×${t.qa_rounds} · ${esc(L.last)} ${esc(t.qa_last)}</span>` : "";
    return `<a class="card" href="${href(t.path)}" data-epic="${esc(t.kind === "fix" ? "fixes" : t.epic)}" data-layers="${esc(layers.join(" "))}">
  <div class="ctop"><b>${esc(t.id)}</b>${t.kind === "fix" ? ` <span class="badge fix">fix</span>` : ` <span class="muted">${esc(t.epic)}</span>`}${readySet.has(t.id) ? ` <span class="badge ready">${esc(L.ready)}</span>` : ""}${t.awaiting_user ? ` <span class="badge q">?</span>` : ""}</div>
  <div class="ctitle">${esc(t.title)}</div>
  ${t.status === "blocked" && t.blocked_reason ? `<div class="reason">${esc(t.blocked_reason)}</div>` : ""}
  <div class="cfoot">${layers.map((l) => `<span class="layer">${esc(l)}</span>`).join("")}${qa}</div>
</a>`;
  };
  const kanban = COLS.map((s) => {
    const ts = all.filter((t) => t.status === s);
    return `<section class="col c-${s}" aria-label="${esc(L[s])}"><h3>${esc(L[s])} <span class="n" data-col="${s}">${ts.length}</span></h3>
${ts.map(card).join("\n") || ""}<p class="emptycol muted">${esc(L.empty)}</p></section>`;
  }).join("\n");

  // Dependency graph per epic (inline SVG, layered layout)
  const W = 190, H = 54, GX = 54, GY = 14, PAD = 12;
  const STATUS_LABEL = (t) => (readySet.has(t.id) ? L.ready : L[t.status] ?? t.status);
  function graph(epicId) {
    const own = all.filter((t) => t.epic === epicId);
    if (!own.length) return `<p class="muted">${esc(L.noTasks)}</p>`;
    const ids = new Set(own.map((t) => t.id));
    const ext = [...new Set(own.flatMap((t) => t.depends_on.filter((d) => tasks.has(d) && !ids.has(d))))];
    const nodes = [...ext.map((id) => ({ ...tasks.get(id), external: true })), ...own];
    const inGraph = new Set(nodes.map((n) => n.id));
    const depth = new Map();
    const d = (id, seen = new Set()) => {
      if (depth.has(id)) return depth.get(id);
      if (seen.has(id)) return 0;
      seen.add(id);
      const n = nodes.find((x) => x.id === id);
      const deps = n.external ? [] : n.depends_on.filter((x) => inGraph.has(x));
      const v = deps.length ? Math.max(...deps.map((x) => d(x, seen) + 1)) : 0;
      depth.set(id, v);
      return v;
    };
    nodes.forEach((n) => d(n.id));
    const cols = [];
    for (const n of nodes) (cols[depth.get(n.id)] ??= []).push(n);
    const row = new Map();
    cols.forEach((col, ci) => {
      if (ci > 0) {
        const bary = (n) => { const ds = n.depends_on.filter((x) => row.has(x)); return ds.length ? ds.reduce((a, x) => a + row.get(x), 0) / ds.length : 1e9; };
        col.sort((a, b) => bary(a) - bary(b) || byId(a, b));
      } else col.sort((a, b) => (b.external ? 1 : 0) - (a.external ? 1 : 0) || byId(a, b));
      col.forEach((n, i) => row.set(n.id, i));
    });
    const maxRows = Math.max(...cols.map((c) => c?.length ?? 0));
    const width = PAD * 2 + cols.length * W + (cols.length - 1) * GX;
    const height = PAD * 2 + maxRows * H + (maxRows - 1) * GY;
    const pos = (id) => {
      const ci = depth.get(id), col = cols[ci];
      const off = ((maxRows - col.length) * (H + GY)) / 2;
      return { x: PAD + ci * (W + GX), y: PAD + off + row.get(id) * (H + GY) };
    };
    const edges = [];
    for (const n of own) for (const dep of n.depends_on) {
      if (!inGraph.has(dep)) continue;
      const a = pos(dep), b = pos(n.id);
      const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x - 4, y2 = b.y + H / 2, mx = (x1 + x2) / 2;
      edges.push(`<path class="edge${tasks.get(dep).status === "done" ? " met" : ""}" d="M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}" marker-end="url(#arrow)"/>`);
    }
    const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
    const boxes = nodes.map((n) => {
      const { x, y } = pos(n.id);
      const cls = `node s-${n.status}${readySet.has(n.id) ? " ready" : ""}${n.external ? " ext" : ""}`;
      const sub = n.external ? `${n.epic} · ${L.external}` : STATUS_LABEL(n) + (n.qa_rounds ? ` · ${L.qa} ×${n.qa_rounds}` : "") + (n.awaiting_user ? " · ?" : "");
      return `<a href="${href(n.path)}"><g class="${cls}" transform="translate(${x} ${y})"><title>${esc(`${n.id}: ${n.title}`)}</title>
<rect width="${W}" height="${H}" rx="8"/><text x="10" y="21" class="t1"><tspan class="tid">${esc(n.id)}</tspan> ${esc(trunc(n.title || "", 20))}</text><text x="10" y="40" class="t2">${esc(trunc(sub, 30))}</text></g></a>`;
    }).join("\n");
    return `<div class="graphwrap"><svg class="graph" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(epicId)}">
${edges.join("\n")}
${boxes}</svg></div>`;
  }
  const graphs = epicList.map((e) => `<section class="gsec" data-epic="${esc(e.id)}"><h3>${esc(e.id)} <span class="muted">${esc(e.title || "")}</span></h3>${graph(e.id)}</section>`).join("\n");
  const legend = `<div class="legend" aria-label="${esc(L.legend)}">${COLS.map((s) => `<span><i class="sw s-${s}"></i>${esc(L[s])}</span>`).join("")}<span><i class="sw ready"></i>${esc(L.ready)}</span></div>`;

  const fixRows = fixes.map((t) => `<tr><td><a href="${href(t.path)}">${esc(t.id)}</a></td><td>${esc(t.title)}</td><td>${esc(t.type || "")}</td><td>${esc(t.severity || "")}</td><td><span class="pill s-${esc(t.status)}">${esc(L[t.status] ?? t.status)}</span></td><td>${t.qa_rounds ? `${L.qa} ×${t.qa_rounds} · ${esc(t.qa_last)}` : "—"}</td></tr>`).join("\n");
  const waitingTasks = all.filter((t) => t.awaiting_user);
  const waitingHtml = waitingTasks.length
    ? waitingTasks.map((t) => `<div class="wait"><div><a href="${href(t.path)}"><b>${esc(t.id)}</b> ${esc(t.title)}</a></div><blockquote>${esc(t.question)}</blockquote><div class="muted">${esc(L.answerHint)} <code>/build-epic${t.epic ? " " + esc(t.epic) : ""}</code></div></div>`).join("\n")
    : "";
  const uatWaiting = epicList.filter((e) => e.status === "in-uat").map((e) => {
    const st = stageOf(e, all.filter((t) => t.epic === e.id));
    return `<div class="wait"><b>${esc(e.id)}</b> ${esc(e.title || "")} — ${esc(st.steps[st.idx])}: <code>${esc(st.next)}</code></div>`;
  }).join("\n");

  const project = basename(resolveProject());
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const html = `<!doctype html>
<html lang="${esc(L === I18N.pl ? "pl" : "en")}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(L.title)} · ${esc(project)}</title>
<!-- Generated by: node scripts/backlog-check.mjs --board. Do not edit by hand. -->
<style>
:root{--bg:#f7f7f5;--surface:#fff;--text:#1d1d1b;--muted:#6b6b66;--border:#e3e2dd;--accent:#4f46e5;
--done:#12b76a;--done-bg:#d1fadf;--wip:#f79009;--wip-bg:#fef0c7;--qa:#2970ff;--qa-bg:#e0eaff;--blocked:#f04438;--blocked-bg:#fee4e2;--todo:#98a2b3;--todo-bg:#fff;--edge:#b9b8b2;--edge-met:#12b76a;--on-accent:#fff}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#141413;--surface:#1f1f1d;--text:#ecebe6;--muted:#9a9993;--border:#33332f;--accent:#8b85ff;
--done:#32d583;--done-bg:#0f2e1f;--wip:#fdb022;--wip-bg:#3a2a0b;--qa:#84adff;--qa-bg:#14234a;--blocked:#f97066;--blocked-bg:#3d1714;--todo:#7a7a74;--todo-bg:#1f1f1d;--edge:#55554f;--edge-met:#32d583;--on-accent:#141413}}
:root[data-theme="dark"]{--bg:#141413;--surface:#1f1f1d;--text:#ecebe6;--muted:#9a9993;--border:#33332f;--accent:#8b85ff;
--done:#32d583;--done-bg:#0f2e1f;--wip:#fdb022;--wip-bg:#3a2a0b;--qa:#84adff;--qa-bg:#14234a;--blocked:#f97066;--blocked-bg:#3d1714;--todo:#7a7a74;--todo-bg:#1f1f1d;--edge:#55554f;--edge-met:#32d583;--on-accent:#141413}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:inherit}
main{max-width:1280px;margin:0 auto;padding:20px 16px 48px}
h1{font-size:20px;margin:0}
h2{font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:32px 0 12px;font-weight:600}
h3{font-size:14px;margin:0 0 10px}
.muted{color:var(--muted)}
code{font:12.5px ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--bg);border:1px solid var(--border);border-radius:5px;padding:1px 5px}
.top{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:baseline;justify-content:space-between}
.totals{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px}
.totals span{display:inline-flex;align-items:center;gap:6px}
.sw{width:10px;height:10px;border-radius:3px;display:inline-block;border:1.5px solid var(--todo);background:var(--todo-bg)}
.sw.s-done{border-color:var(--done);background:var(--done-bg)}.sw.s-in-progress{border-color:var(--wip);background:var(--wip-bg)}
.sw.s-in-qa{border-color:var(--qa);background:var(--qa-bg)}.sw.s-blocked{border-color:var(--blocked);background:var(--blocked-bg)}
.sw.ready{border:2px dashed var(--accent);background:transparent}
.errors{border:1px solid var(--blocked);background:var(--blocked-bg);border-radius:10px;padding:10px 14px;margin-top:16px}
.errors ul{margin:6px 0 0;padding-left:18px}
.epics{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,380px),1fr));gap:12px}
.epic{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px}
.epic header{display:flex;gap:8px;align-items:baseline}
.eid{font-weight:700;text-decoration:none}.etitle{flex:1;min-width:0}.count{color:var(--muted);font-variant-numeric:tabular-nums}
.bar{display:flex;height:8px;border-radius:99px;background:var(--border);overflow:hidden;margin:10px 0 12px}
.seg.s-done{background:var(--done)}.seg.s-in-qa{background:var(--qa)}.seg.s-in-progress{background:var(--wip)}.seg.s-blocked{background:var(--blocked)}
.stepper{list-style:none;display:flex;flex-wrap:wrap;gap:4px;margin:0 0 10px;padding:0;counter-reset:s}
.stepper li{font-size:12px;padding:3px 9px;border-radius:99px;border:1px solid var(--border);color:var(--muted)}
.stepper li.past{color:var(--done);border-color:var(--done)}
.stepper li.past::before{content:"✓ "}
.stepper li.now{background:var(--accent);border-color:var(--accent);color:var(--on-accent);font-weight:600}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{font-size:12px;border-radius:6px;padding:3px 8px;border:1px solid var(--border);text-decoration:none}
.chip.v-pass{border-color:var(--done);background:var(--done-bg)}.chip.v-fail{border-color:var(--blocked);background:var(--blocked-bg)}
.next{margin-top:10px;font-size:13px}
.filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}
select,button{font:inherit;color:inherit;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:5px 10px;cursor:pointer}
button[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.kanban{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:10px;align-items:start}
.col{background:var(--surface);border:1px solid var(--border);border-top:3px solid var(--todo);border-radius:10px;padding:10px;min-height:80px}
.col.c-in-progress{border-top-color:var(--wip)}.col.c-in-qa{border-top-color:var(--qa)}.col.c-blocked{border-top-color:var(--blocked)}.col.c-done{border-top-color:var(--done)}
.col h3{display:flex;justify-content:space-between}.n{color:var(--muted);font-weight:500}
.card{display:block;text-decoration:none;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:8px}
.card:hover{border-color:var(--accent)}
.card[hidden]{display:none}
.ctop{display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center;font-size:12.5px}
.ctitle{margin:3px 0 6px}
.cfoot{display:flex;flex-wrap:wrap;gap:4px}
.layer{font-size:11px;padding:1px 6px;border-radius:4px;background:var(--surface);border:1px solid var(--border);color:var(--muted)}
.badge{white-space:nowrap;font-size:11px;padding:1px 6px;border-radius:99px;border:1px solid var(--border)}
.badge.ready{border:1.5px dashed var(--accent);color:var(--accent)}
.badge.q{background:var(--wip-bg);border-color:var(--wip);font-weight:700}
.badge.fix{background:var(--blocked-bg);border-color:var(--blocked)}
.badge.qa-fail{border-color:var(--blocked);color:var(--blocked)}.badge.qa-pass{border-color:var(--done);color:var(--done)}
.reason{font-size:12px;color:var(--blocked);margin-bottom:6px}
.emptycol{font-size:12px;margin:4px 0;display:none}
.col.isempty .emptycol{display:block}
.legend{display:flex;flex-wrap:wrap;gap:6px 14px;margin-bottom:12px;font-size:12.5px}
.legend span{display:inline-flex;align-items:center;gap:6px}
.gsec{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:12px}
.gsec[hidden]{display:none}
.graphwrap{overflow-x:auto}
.graph{display:block}
.graph .edge{fill:none;stroke:var(--edge);stroke-width:1.5}
.graph .edge.met{stroke:var(--edge-met)}
#arrow path{fill:var(--edge)}
.node rect{fill:var(--todo-bg);stroke:var(--todo);stroke-width:1.5}
.node.s-done rect{fill:var(--done-bg);stroke:var(--done)}.node.s-in-progress rect{fill:var(--wip-bg);stroke:var(--wip)}
.node.s-in-qa rect{fill:var(--qa-bg);stroke:var(--qa)}.node.s-blocked rect{fill:var(--blocked-bg);stroke:var(--blocked)}
.node.ready rect{stroke:var(--accent);stroke-width:2.5;stroke-dasharray:6 4}
.node.ext{opacity:.6}.node.ext rect{stroke-dasharray:3 3}
.node text{fill:var(--text);font-size:12.5px}.node .t2{fill:var(--muted);font-size:11.5px}.node .tid{font-weight:700}
a:hover .node rect{stroke-width:2.5}
table{width:100%;border-collapse:collapse;background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--border);font-size:13px;vertical-align:top}
th{color:var(--muted);font-weight:600}
.tablewrap{overflow-x:auto}
.pill{font-size:12px;padding:1px 8px;border-radius:99px;border:1px solid var(--todo)}
.pill.s-done{border-color:var(--done);background:var(--done-bg)}.pill.s-in-progress{border-color:var(--wip);background:var(--wip-bg)}
.pill.s-in-qa{border-color:var(--qa);background:var(--qa-bg)}.pill.s-blocked{border-color:var(--blocked);background:var(--blocked-bg)}
.wait{background:var(--surface);border:1px solid var(--border);border-left:4px solid var(--wip);border-radius:10px;padding:10px 14px;margin-bottom:8px}
.wait a{text-decoration:none}
blockquote{margin:6px 0;padding:6px 10px;border-left:3px solid var(--border);color:var(--text);background:var(--bg);border-radius:4px}
nav.toc{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
nav.toc a{font-size:13px;text-decoration:none;border:1px solid var(--border);border-radius:99px;padding:3px 10px;background:var(--surface)}
</style>
</head>
<body>
<main>
<div class="top"><h1>${esc(L.title)} · ${esc(project)}</h1><span class="muted">${esc(L.generated)}: ${esc(stamp)}</span></div>
<div class="totals">${COLS.map((s) => `<span><i class="sw s-${s}"></i>${esc(L[s])}: <b>${counts[s]}</b></span>`).join("")}<span class="muted">· ${all.length} ${esc(L.tasks)}</span></div>
<nav class="toc"><a href="#waiting">${esc(L.waiting)} (${waitingTasks.length + epicList.filter((e) => e.status === "in-uat").length})</a><a href="#epics">${esc(L.epics)}</a><a href="#board">${esc(L.board)}</a><a href="#graphs">${esc(L.graphs)}</a><a href="#fixes">${esc(L.fixes)} (${fixes.length})</a></nav>
${errors.length ? `<div class="errors"><b>${esc(L.errors)} (${errors.length})</b><ul>${errors.slice(0, 20).map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>` : ""}

<h2 id="waiting">${esc(L.waiting)}</h2>
${waitingHtml}${uatWaiting}${!waitingHtml && !uatWaiting ? `<p class="muted">${esc(L.noWaiting)}</p>` : ""}

<h2 id="epics">${esc(L.epics)}</h2>
<div class="epics">${epicCards || `<p class="muted">${esc(L.noTasks)}</p>`}</div>

<h2 id="board">${esc(L.board)}</h2>
<div class="filters">
<label>${esc(L.epic)} <select id="f-epic"><option value="">${esc(L.all)}</option>${epicList.map((e) => `<option value="${esc(e.id)}">${esc(e.id)} ${esc(e.title || "")}</option>`).join("")}${fixes.length ? `<option value="fixes">${esc(L.fixesOpt)}</option>` : ""}</select></label>
${allLayers.length ? `<span class="muted">${esc(L.layers)}:</span>${allLayers.map((l) => `<button type="button" class="f-layer" data-layer="${esc(l)}" aria-pressed="false">${esc(l)}</button>`).join("")}<button type="button" id="f-clear">${esc(L.clear)}</button>` : ""}
</div>
<div class="kanban">${kanban}</div>

<h2 id="graphs">${esc(L.graphs)}</h2>
${legend}
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"/></marker></defs></svg>
${graphs || `<p class="muted">${esc(L.noTasks)}</p>`}

<h2 id="fixes">${esc(L.fixes)}</h2>
${fixes.length ? `<div class="tablewrap"><table><thead><tr><th>${esc(L.id)}</th><th>${esc(L.name)}</th><th>${esc(L.type)}</th><th>${esc(L.severity)}</th><th>${esc(L.status)}</th><th>${esc(L.qa)}</th></tr></thead><tbody>${fixRows}</tbody></table></div>` : `<p class="muted">${esc(L.noFixes)}</p>`}
</main>
<script>
(function(){
  var KEY="backlog-board-filters", sel=document.getElementById("f-epic"), btns=[].slice.call(document.querySelectorAll(".f-layer"));
  function apply(){
    var ep=sel.value, on=btns.filter(function(b){return b.getAttribute("aria-pressed")==="true"}).map(function(b){return b.dataset.layer});
    document.querySelectorAll(".card").forEach(function(c){
      var ls=(c.dataset.layers||"").split(" ");
      var ok=(!ep||c.dataset.epic===ep)&&(!on.length||on.some(function(l){return ls.indexOf(l)>=0}));
      c.hidden=!ok;
    });
    document.querySelectorAll(".col").forEach(function(col){
      var n=col.querySelectorAll(".card:not([hidden])").length;
      col.querySelector(".n").textContent=n; col.classList.toggle("isempty",n===0);
    });
    document.querySelectorAll(".gsec").forEach(function(g){g.hidden=!!ep&&g.dataset.epic!==ep});
    try{localStorage.setItem(KEY,JSON.stringify({epic:ep,layers:on}))}catch(e){}
  }
  try{var s=JSON.parse(localStorage.getItem(KEY)||"null");if(s){if([].some.call(sel.options,function(o){return o.value===s.epic}))sel.value=s.epic;btns.forEach(function(b){b.setAttribute("aria-pressed",String((s.layers||[]).indexOf(b.dataset.layer)>=0))})}}catch(e){}
  sel.addEventListener("change",apply);
  btns.forEach(function(b){b.addEventListener("click",function(){b.setAttribute("aria-pressed",String(b.getAttribute("aria-pressed")!=="true"));apply()})});
  var clr=document.getElementById("f-clear"); if(clr) clr.addEventListener("click",function(){sel.value="";btns.forEach(function(b){b.setAttribute("aria-pressed","false")});apply()});
  apply();
})();
</script>
</body>
</html>
`;
  const out = join(ROOT, "board.html");
  writeFileSync(out, html);
  // stderr, so --summary / --json output on stdout stays valid JSON
  console.error(`Wrote ${out}`);
}

function resolveProject() {
  // project folder name = parent of docs/ (falls back to the current directory)
  return dirname(dirname(resolve(ROOT)));
}

if (flag("--board")) writeBoard();

if (flag("--json")) {
  const strip = ({ dir, path, ...rest }) => rest;
  console.log(JSON.stringify({
    errors, warnings, counts,
    frontier: frontier.map((t) => t.id),
    tasks: all.map(strip),
    stories: [...stories.values()].map(strip),
    epics: [...epics.values()].map(strip),
  }, null, 2));
  process.exit(errors.length ? 1 : 0);
}

if (flag("--summary")) {
  const epicIdx = args.indexOf("--epic");
  const only = epicIdx >= 0 ? args[epicIdx + 1] : null;
  const scope = all.filter((t) => !only || t.epic === only);
  const ids = (list) => list.map((t) => t.id);
  const open = (t) => !t.awaiting_user;
  const scopedCounts = Object.fromEntries(STATUSES.map((st) => [st, scope.filter((t) => t.status === st).length]));
  console.log(JSON.stringify({
    ok: errors.length === 0,
    errors,
    epic: only,
    counts: scopedCounts,
    awaiting_user: ids(scope.filter((t) => t.awaiting_user)),
    in_qa: ids(scope.filter((t) => t.status === "in-qa" && open(t))),
    qa_failed: scope.filter((t) => t.status === "in-progress" && t.qa_last === "fail" && open(t)).map((t) => ({ id: t.id, qa_rounds: t.qa_rounds })),
    resumable: ids(scope.filter((t) => t.status === "in-progress" && t.qa_last !== "fail" && open(t))),
    ready: ids(frontier.filter((t) => (!only || t.epic === only) && open(t))),
    blocked: scope.filter((t) => t.status === "blocked").map((t) => ({ id: t.id, reason: t.blocked_reason || "" })),
    epics: [...epics.values()].filter((e) => !only || e.id === only).map((e) => ({ id: e.id, status: e.status, approved: e.approved || "" })),
  }));
  process.exit(errors.length ? 1 : 0);
}

if (flag("--next")) {
  if (!frontier.length) console.log("No task is ready. Check blocked or in-progress tasks.");
  for (const t of frontier) console.log(`${t.id}\t${t.title}\t${t.file}`);
  process.exit(errors.length ? 1 : 0);
}

if (flag("--write-index")) {
  const rows = all
    .map((t) => `| [${t.id}](${relative(ROOT, t.file).replace(/\\/g, "/")}) | ${t.title} | ${t.epic} | ${t.story} | ${t.status} | ${t.depends_on.join(", ") || "—"} |`)
    .join("\n");
  const md = `# Backlog index

> Generated by \`node scripts/backlog-check.mjs --write-index\`. Do not edit by hand.

**Status:** ${counts.done} done · ${counts["in-qa"]} in QA · ${counts["in-progress"]} in progress · ${counts.todo} todo · ${counts.blocked} blocked

## Ready to start

${frontier.length ? frontier.map((t) => `- ${t.id} — ${t.title}`).join("\n") : "_Nothing ready._"}

## Waiting for QA

${all.filter((t) => t.status === "in-qa").map((t) => `- ${t.id} — ${t.title}`).join("\n") || "_Nothing waiting._"}

## Dependency graph

\`\`\`mermaid
${mermaid()}
\`\`\`

## All tasks

| Task | Title | Epic | Story | Status | Depends on |
| --- | --- | --- | --- | --- | --- |
${rows}
`;
  writeFileSync(join(ROOT, "index.md"), md);
  console.log(`Wrote ${join(ROOT, "index.md")}`);
}

console.log(`Tasks: ${all.length} (${counts.done} done, ${counts["in-qa"]} in QA, ${counts["in-progress"]} in progress, ${counts.todo} todo, ${counts.blocked} blocked)`);
const inQa = all.filter((t) => t.status === "in-qa");
if (inQa.length) console.log(`Waiting for QA: ${inQa.map((t) => t.id).join(", ")}`);
console.log(`Epics: ${epics.size}  Stories: ${stories.size}`);
if (frontier.length) console.log(`Ready to start: ${frontier.map((t) => t.id).join(", ")}`);
for (const w of warnings) console.log(`WARN  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
if (!errors.length) console.log("OK: no errors");
process.exit(errors.length ? 1 : 0);
