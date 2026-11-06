// backlog-check: przekazanie pracy do innego epiku („to E-02”, „w E-02”, „→ E-02”) musi mieć
// odbiorcę (T-099). Każdy test buduje backlog-fiksturę w katalogu tymczasowym i uruchamia CLI
// z --root, tak jak robi to CI.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("../backlog-check.mjs", import.meta.url));

const epic = (id, status, extra = "") =>
  `---\nid: ${id}\ntitle: Epik ${id}\nstatus: ${status}\nbranch: epic/${id}-x\n---\n\n# ${id}\n\n## Out of scope for this epic\n\n${extra}\n`;
const story = (id, epicId) => `---\nid: ${id}\ntitle: Story\nepic: ${epicId}\nstatus: todo\n---\n`;
const task = (id, epicId, storyId, body, related = "[]") =>
  `---\nid: ${id}\ntitle: Task ${id}\nepic: ${epicId}\nstory: ${storyId}\nstatus: done\ndepends_on: []\nlayers: [web]\nrelated_tasks: ${related}\n---\n\n# ${id}\n\n## Notes\n\n${body}\n`;

// Odpowiednik T-005: notatka „to E-02” w linii 16 pliku taska E-01.
const HANDOFF = "- Uczestnik nie widzi menu, bo „Opuść listę” to E-02 (F-13).";
const HANDOFF_LINE = 16;

function run(files) {
  const dir = mkdtempSync(join(tmpdir(), "backlog-check-"));
  try {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
    const stdout = execFileSync(process.execPath, [SCRIPT, "--root", "backlog"], {
      cwd: dir,
      encoding: "utf8",
    });
    return stdout.replaceAll("\\", "/");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const SOURCE = "backlog/E-01-a/S-01-01-a/T-001-a.md";
const base = (receiver) => ({
  "backlog/E-01-a/epic.md": epic("E-01", "done"),
  "backlog/E-01-a/S-01-01-a/story.md": story("S-01-01", "E-01"),
  [SOURCE]: task("T-001", "E-01", "S-01-01", HANDOFF),
  "backlog/E-02-b/epic.md": epic("E-02", "in-progress"),
  "backlog/E-02-b/S-02-01-b/story.md": story("S-02-01", "E-02"),
  "backlog/E-02-b/S-02-01-b/T-002-b.md": receiver,
});
const handoffWarnings = (out) => out.split("\n").filter((l) => /^WARN .*hands work over/.test(l));

test("niepokryte przekazanie → ostrzeżenie z plikiem, linią i epikiem docelowym (AC1)", () => {
  const out = run(base(task("T-002", "E-02", "S-02-01", "Coś innego.")));
  const warns = handoffWarnings(out);
  assert.equal(warns.length, 1, out);
  assert.ok(warns[0].includes(`${SOURCE}:${HANDOFF_LINE}`), warns[0]);
  assert.ok(warns[0].includes("E-02"), warns[0]);
  assert.match(out, /OK: no errors/);
});

const handing = (line) => {
  const files = base(task("T-002", "E-02", "S-02-01", "Coś innego."));
  files[SOURCE] = task("T-001", "E-01", "S-01-01", line);
  return files;
};

test("linia przekazania wymienia task epiku docelowego → brak ostrzeżenia (AC2)", () => {
  const out = run(handing(`${HANDOFF} Przejął T-002.`));
  assert.deepEqual(handoffWarnings(out), []);
});

test("linia przekazania wymienia story epiku docelowego → brak ostrzeżenia (AC2)", () => {
  const out = run(handing("- Nagłówek z tokenem dla mobile dochodzi w E-02 (S-02-01)."));
  assert.deepEqual(handoffWarnings(out), []);
});

test("linia przekazania wymienia task lub story innego epiku → ostrzeżenie (AC1)", () => {
  const out = run(handing("- Opuść listę to E-02; tu tylko S-01-01 i T-001."));
  assert.equal(handoffWarnings(out).length, 1);
});

test("ID źródła w related_tasks i w treści taska epiku docelowego nie pokrywa przekazania (AC2)", () => {
  const files = base(task("T-002", "E-02", "S-02-01", "Błędy jak w T-001.", "[T-001]"));
  assert.equal(handoffWarnings(run(files)).length, 1);
});

test("przekazanie wymienione w „Out of scope” epiku docelowego → brak ostrzeżenia (AC1)", () => {
  const files = base(task("T-002", "E-02", "S-02-01", "Coś innego."));
  files["backlog/E-02-b/epic.md"] = epic("E-02", "in-progress", "- „Opuść listę” z T-001: E-03.");
  assert.deepEqual(handoffWarnings(run(files)), []);
});

test("ID źródła poza „Out of scope” epiku docelowego nie pokrywa przekazania (AC1)", () => {
  const files = base(task("T-002", "E-02", "S-02-01", "Coś innego."));
  files["backlog/E-02-b/epic.md"] = epic("E-02", "in-progress").replace(
    "## Out",
    "Po T-001.\n\n## Out",
  );
  assert.equal(handoffWarnings(run(files)).length, 1);
});

test("fraza z własnym epikiem taska („w E-01” w tasku E-01) → brak ostrzeżenia", () => {
  const files = base(task("T-002", "E-02", "S-02-01", "Coś innego."));
  files[SOURCE] = task("T-001", "E-01", "S-01-01", "- Zrobione w E-01, bez zmian.");
  assert.deepEqual(handoffWarnings(run(files)), []);
});

test("przekazanie do epiku w statusie todo (jeszcze nieplanowanego) → brak ostrzeżenia", () => {
  const files = base(task("T-002", "E-02", "S-02-01", "Coś innego."));
  files["backlog/E-02-b/epic.md"] = epic("E-02", "todo");
  assert.deepEqual(handoffWarnings(run(files)), []);
});

test("fraza w bloku kodu i w `kodzie` w linii → brak ostrzeżenia", () => {
  const files = base(task("T-002", "E-02", "S-02-01", "Coś innego."));
  const body = "```text\nto E-02\n```\n- Wzorzec: `→ E-02`.";
  files[SOURCE] = task("T-001", "E-01", "S-01-01", body);
  assert.deepEqual(handoffWarnings(run(files)), []);
});

const fix = (id, body, related = "[]") =>
  `---\nid: ${id}\ntitle: Fix ${id}\nkind: fix\nstatus: done\ndepends_on: []\nlayers: [web]\nrelated_tasks: ${related}\n---\n\n# ${id}\n\n## Report\n\n${body}\n`;

test("linia przekazania wymienia fix task na gałęzi epiku docelowego → brak ostrzeżenia (AC2, jak T-094)", () => {
  const files = handing(`${HANDOFF} Przejął T-003.`);
  files["backlog/fixes/T-003-c.md"] = fix("T-003", "Gałąź: `epic/E-02-b`.");
  assert.deepEqual(handoffWarnings(run(files)), []);
});

test("linia przekazania wymienia fix task z gałęzi innego epiku → ostrzeżenie", () => {
  const files = handing(`${HANDOFF} Przejął T-003.`);
  files["backlog/fixes/T-003-c.md"] = fix("T-003", "Gałąź: `epic/E-01-a`.");
  assert.equal(handoffWarnings(run(files)).length, 1);
});

test("fix task na gałęzi epiku z frazą o tym samym epiku („→ E-02”) → brak ostrzeżenia", () => {
  const files = handing(`${HANDOFF} Przejął T-002.`);
  files["backlog/fixes/T-003-c.md"] = fix(
    "T-003",
    "Gałąź: `epic/E-02-b`. Przekazanie E-01 → E-02.",
  );
  assert.deepEqual(handoffWarnings(run(files)), []);
});

test("dwie frazy do tego samego epiku w jednej linii → jedno ostrzeżenie", () => {
  const out = run(handing("- SC-03 to E-02; do E-02 link prowadzi na SC-01."));
  assert.equal(handoffWarnings(out).length, 1, out);
});

// T-102: ID epiku w przekazaniu małymi literami („to e-02”) liczy się jak „to E-02”.
test("„to e-02” z odbiorcą T-002 w linii → brak ostrzeżenia (T-102 AC1)", () => {
  const out = run(handing("- Opuść listę to e-02; przejął T-002."));
  assert.deepEqual(handoffWarnings(out), []);
});

test("„w e-01” we własnym epiku i „to e-02” przy E-02 w statusie todo → brak ostrzeżenia (T-102 AC2)", () => {
  const own = base(task("T-002", "E-02", "S-02-01", "Coś innego."));
  own[SOURCE] = task("T-001", "E-01", "S-01-01", "- Zrobione w e-01, bez zmian.");
  assert.deepEqual(handoffWarnings(run(own)), []);
  const todo = handing("- Opuść listę to e-02.");
  todo["backlog/E-02-b/epic.md"] = epic("E-02", "todo");
  assert.deepEqual(handoffWarnings(run(todo)), []);
});

test("niepokryte „to e-02” → jedno ostrzeżenie z E-02, także z „to E-02” i „do e-02” w linii (T-102 AC3)", () => {
  for (const line of [
    "- Opuść listę to e-02.",
    "- SC-03 to E-02; do e-02 link prowadzi na SC-01.",
  ]) {
    const warns = handoffWarnings(run(handing(line)));
    assert.equal(warns.length, 1, line);
    assert.match(warns[0], /hands work over to E-02 .*names no E-02 task/, warns[0]);
    assert.doesNotMatch(warns[0], /e-02 task|to e-02 \(|, and e-02/, warns[0]);
  }
});
