// backlog-check: przekazanie pracy do innego epiku („to E-02”, „w E-02”, „→ E-02”) musi mieć
// odbiorcę (ostrzeżenie, T-099); zadanie `done` ma odhaczone wszystkie AC, a status przy ID zadania
// w `UAT.md` epiku zgadza się z plikiem zadania (błędy, T-110); nowy plik testu z commitów zadania
// ma wiersz w „Historia zmian” przewodnika warstwy (błąd, T-117; fikstura z repozytorium git). `--write-index` wpisuje „—” w pustych polach Epic i Story (T-116). Każdy test buduje backlog-fiksturę
// w katalogu tymczasowym i uruchamia CLI z --root, tak jak robi to CI.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

// T-110: zadanie `done` musi mieć odhaczone AC, a status przy ID w `UAT.md` epiku musi być taki
// jak w pliku zadania. Oba przypadki to błąd (kod wyjścia 1).
function check(files) {
  const dir = mkdtempSync(join(tmpdir(), "backlog-check-"));
  try {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
    const r = spawnSync(process.execPath, [SCRIPT, "--root", "backlog"], {
      cwd: dir,
      encoding: "utf8",
    });
    return { code: r.status, out: (r.stdout + r.stderr).replaceAll("\\", "/") };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const errorLines = (out) => out.split("\n").filter((l) => l.startsWith("ERROR "));
const fixWith = (id, status, ac) =>
  `---\nid: ${id}\ntitle: Fix ${id}\nkind: fix\nstatus: ${status}\ndepends_on: []\nlayers: [web]\n---\n\n# ${id}\n\n## Report\n\n- [ ] w raporcie to nie AC\n\n${ac}## Notes\n\n- [ ] notatka to nie AC\n`;
const AC = (...marks) =>
  `## Acceptance criteria\n\n${marks.map((m, i) => `${m} AC${i + 1}: coś.`).join("\n")}\n\n`;
const epicFiles = (uat, fixes) => ({
  "backlog/E-01-a/epic.md": epic("E-01", "in-uat"),
  "backlog/E-01-a/S-01-01-a/story.md": story("S-01-01", "E-01"),
  "backlog/E-01-a/S-01-01-a/T-001-a.md": task("T-001", "E-01", "S-01-01", "Nic."),
  ...(uat === null ? {} : { "backlog/E-01-a/UAT.md": uat }),
  ...fixes,
});

test("done z nieodhaczonym AC → błąd z plikiem i liczbą nieodhaczonych AC (T-110 AC1)", () => {
  const ac =
    "## Acceptance criteria\n\n- [x] AC1: a\n- [ ] AC2: b\n\n### Podsekcja\n\n  - [ ] AC3: wcięte\n\n";
  const { code, out } = check(
    epicFiles(null, { "backlog/fixes/T-002-b.md": fixWith("T-002", "done", ac) }),
  );
  assert.equal(code, 1, out);
  const errs = errorLines(out);
  assert.equal(errs.length, 1, out);
  assert.match(
    errs[0],
    /backlog\/fixes\/T-002-b\.md: status done but 2 of 3 acceptance criteria are unchecked/,
    errs[0],
  );
});

test("done z odhaczonymi AC (także [X]), todo z nieodhaczonymi i brak sekcji AC → OK (T-110 AC1)", () => {
  const { code, out } = check(
    epicFiles(null, {
      "backlog/fixes/T-002-b.md": fixWith("T-002", "done", AC("- [x]", "- [X]", "* [x]")),
      "backlog/fixes/T-003-c.md": fixWith("T-003", "todo", AC("- [ ]", "- [ ]")),
      "backlog/fixes/T-004-d.md": fixWith("T-004", "in-qa", AC("- [ ]")),
      "backlog/fixes/T-005-e.md": fixWith("T-005", "done", ""),
    }),
  );
  assert.equal(code, 0, out);
  assert.deepEqual(errorLines(out), []);
});

const UAT_HEAD = "# UAT E-01\n\nPrzygotował: QA.\n\n## Znane ograniczenia\n\n";
const fixes3 = {
  "backlog/fixes/T-002-b.md": fixWith("T-002", "done", ""),
  "backlog/fixes/T-003-c.md": fixWith("T-003", "todo", ""),
  "backlog/fixes/T-004-d.md": fixWith("T-004", "done", ""),
};

test("UAT.md podaje status inny niż plik zadania → błąd z linią, ID i oboma statusami (T-110 AC2)", () => {
  const uat = `${UAT_HEAD}- Zadania: T-002 (opis, z QA T-003) \`todo\`; T-003 (x) \`todo\`.\n`;
  const { code, out } = check(epicFiles(uat, fixes3));
  assert.equal(code, 1, out);
  const errs = errorLines(out);
  assert.equal(errs.length, 1, out);
  assert.match(
    errs[0],
    /backlog\/E-01-a\/UAT\.md:7: T-002 is "todo" here but "done" in backlog\/fixes\/T-002-b\.md/,
    errs[0],
  );
});

test("UAT.md: status dla kilku ID i zakresu, zapis „(todo)” bez backticków → każde ID sprawdzone (T-110 AC2)", () => {
  const uat = `${UAT_HEAD}- T-002 i T-003–T-004 \`done\`.\n- Otwarte: T-004 (todo).\n`;
  const errs = errorLines(check(epicFiles(uat, fixes3)).out);
  assert.equal(errs.length, 2, errs.join("\n"));
  assert.match(errs[0], /UAT\.md:7: T-003 is "done" here but "todo"/);
  assert.match(errs[1], /UAT\.md:8: T-004 is "todo" here but "done"/);
});

test("UAT.md: ID bez statusu, status po „;” innego zdania i ID w `kodzie` → OK (T-110 AC2)", () => {
  const uat = `${UAT_HEAD}- T-003 bez statusu; T-002 \`done\`. Plik \`T-003-c.md\` \`done\`.\n- Po T-003 (todo) i T-002.\n`;
  const { code, out } = check(epicFiles(uat, fixes3));
  assert.equal(code, 0, out);
});

// T-117: zadanie `in-qa`/`done`, którego commity („T-NNN: …”) dodały plik testu w katalogu warstwy
// z `layers:` (katalogi: `paths:` we frontmatter przewodnika warstwy), musi mieć wiersz z ID zadania
// w „## Historia zmian” przewodnika tej warstwy (błąd). Fikstura jest repozytorium git.
const guide = (layer, paths, rows) =>
  `---\nlayer: ${layer}\npaths: [${paths.join(", ")}]\n---\n\n# ${layer}\n\n## Pułapki\n\n- T-005 tu się nie liczy.\n\n## Historia zmian\n\n| Data | Zmiana |\n| --- | --- |\n${rows.map((r) => `| 2026-11-10 | ${r} |`).join("\n")}\n`;
const layerTask = (id, status, layers) =>
  `---\nid: ${id}\ntitle: Fix ${id}\nkind: fix\nstatus: ${status}\ndepends_on: []\nlayers: [${layers.join(", ")}]\n---\n\n# ${id}\n`;
const DATE = "2026-11-12T10:00:00+01:00";
// commits: [message, { path: text }, date?]
function checkGit(files, commits, { shallow = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "backlog-check-git-"));
  const git = (args, date = DATE) =>
    execFileSync("git", args, {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
    });
  try {
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.email", "t@example.com"]);
    git(["config", "user.name", "T"]);
    git(["config", "core.autocrlf", "false"]);
    const put = (map) => {
      for (const [path, text] of Object.entries(map)) {
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), text);
      }
    };
    put(files);
    git(["add", "-A"]);
    git(["commit", "-q", "-m", "start"], "2026-11-01T10:00:00+01:00");
    for (const [message, map, date] of commits) {
      for (const [path, text] of Object.entries(map)) {
        if (text === null) git(["mv", path.split(" -> ")[0], path.split(" -> ")[1]]);
        else put({ [path]: text });
      }
      git(["add", "-A"]);
      git(["commit", "-q", "-m", message], date);
    }
    let cwd = dir;
    if (shallow) {
      cwd = join(dir, "shallow");
      git(["clone", "-q", "--depth", "1", `file://${dir.replaceAll("\\", "/")}`, cwd]);
    }
    const r = spawnSync(process.execPath, [SCRIPT, "--root", "backlog"], {
      cwd,
      encoding: "utf8",
    });
    return { code: r.status, out: (r.stdout + r.stderr).replaceAll("\\", "/") };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const LAYERS = "docs/architecture/layers";
const repo = (rows, status = "in-qa", layers = ["backend"]) => ({
  [`${LAYERS}/backend.md`]: guide("backend", ["apps/api/"], rows.backend ?? []),
  [`${LAYERS}/infra.md`]: guide("infra", ["scripts/", ".github/"], rows.infra ?? []),
  [`${LAYERS}/db.md`]: guide("db", ["apps/api/test/", "apps/api/drizzle/"], rows.db ?? []),
  [`${LAYERS}/web.md`]: guide("web", ["apps/web/"], rows.web ?? []),
  "backlog/fixes/T-005-a.md": layerTask("T-005", status, layers),
});
const testRowErrors = (out) =>
  out.split("\n").filter((l) => /^ERROR .*Historia zmian|^ERROR .*change log/i.test(l));

test("commit zadania in-qa dodał test w warstwie, przewodnik bez wiersza → błąd z zadaniem, plikiem i przewodnikiem (T-117 AC1)", () => {
  const { code, out } = checkGit(repo({}), [
    ["T-005: fix x", { "apps/api/test/reset-mail.copy.test.ts": "test\n" }],
  ]);
  assert.equal(code, 1, out);
  const errs = testRowErrors(out);
  assert.equal(errs.length, 1, out);
  assert.match(errs[0], /backlog\/fixes\/T-005-a\.md/, errs[0]);
  assert.match(errs[0], /apps\/api\/test\/reset-mail\.copy\.test\.ts/, errs[0]);
  assert.match(errs[0], /docs\/architecture\/layers\/backend\.md/, errs[0]);
});

test("ten sam przypadek z wierszem T-005 w „Historia zmian” przewodnika → brak zgłoszenia (T-117 AC2)", () => {
  const { code, out } = checkGit(repo({ backend: ["T-005: test maila"] }), [
    ["T-005: fix x", { "apps/api/test/reset-mail.copy.test.ts": "test\n" }],
  ]);
  assert.equal(code, 0, out);
  assert.deepEqual(testRowErrors(out), []);
});

test("plik pod kilkoma warstwami zadania: wiersz w przewodniku jednej z nich wystarcza (T-117)", () => {
  const { code, out } = checkGit(
    repo({ db: ["T-005: test migracji"] }, "done", ["backend", "db"]),
    [["T-005: fix x", { "apps/api/test/name-key.test.ts": "test\n" }]],
  );
  assert.equal(code, 0, out);
  const both = checkGit(repo({}, "done", ["backend", "db"]), [
    ["T-005: fix x", { "apps/api/test/name-key.test.ts": "test\n" }],
  ]);
  const errs = testRowErrors(both.out);
  assert.equal(errs.length, 1, both.out);
  assert.match(errs[0], /layers\/backend\.md or docs\/architecture\/layers\/db\.md/, errs[0]);
});

test("test w apps/web/src (obok kodu) i *.spec.ts w apps/web/e2e → zgłoszenie dla warstwy web (T-117)", () => {
  const { out } = checkGit(repo({}, "in-qa", ["web"]), [
    [
      "T-005: fix x",
      {
        "apps/web/src/screens/x.test.tsx": "t\n",
        "apps/web/e2e/x.spec.ts": "t\n",
        "apps/web/src/x.ts": "c\n",
      },
    ],
  ]);
  const errs = testRowErrors(out);
  assert.equal(errs.length, 2, out);
  assert.ok(
    errs.some((e) => e.includes("apps/web/src/screens/x.test.tsx")),
    out,
  );
  assert.ok(
    errs.some((e) => e.includes("apps/web/e2e/x.spec.ts")),
    out,
  );
});

test("bez zgłoszenia: status todo/in-progress, katalog warstwy spoza layers:, commit innego zadania, zmiana w istniejącym teście (T-117)", () => {
  for (const status of ["todo", "in-progress"]) {
    const { out } = checkGit(repo({}, status), [
      ["T-005: x", { "apps/api/test/a.test.ts": "t\n" }],
    ]);
    assert.deepEqual(testRowErrors(out), [], status);
  }
  const other = checkGit(repo({}), [
    ["T-005: x", { "scripts/test/a.test.sh": "t\n" }],
    ["T-006: x", { "apps/api/test/b.test.ts": "t\n" }],
    ["T-005 bez dwukropka", { "apps/api/test/c.test.ts": "t\n" }],
  ]);
  assert.deepEqual(testRowErrors(other.out), [], other.out);
  const edit = checkGit({ ...repo({}), "apps/api/test/a.test.ts": "t\n" }, [
    ["T-005: x", { "apps/api/test/a.test.ts": "t\nnowy describe\n" }],
  ]);
  assert.deepEqual(testRowErrors(edit.out), [], edit.out);
});

test("zmiana nazwy pliku testu nie jest nowym testem (T-117)", () => {
  const { code, out } = checkGit({ ...repo({}), "apps/api/test/old.test.ts": "t\nt\nt\nt\n" }, [
    ["T-005: x", { "apps/api/test/old.test.ts -> apps/api/test/new.test.ts": null }],
  ]);
  assert.equal(code, 0, out);
  assert.deepEqual(testRowErrors(out), []);
});

test("data graniczna: commit przed 2026-11-10 pominięty, z 2026-11-10 00:30 liczony (T-117 AC3)", () => {
  const before = checkGit(repo({}), [
    ["T-005: x", { "apps/api/test/a.test.ts": "t\n" }, "2026-11-09T23:30:00+01:00"],
  ]);
  assert.deepEqual(testRowErrors(before.out), [], before.out);
  const early = checkGit(repo({}), [
    ["T-005: x", { "apps/api/test/a.test.ts": "t\n" }, "2026-11-10T00:30:00+01:00"],
  ]);
  assert.equal(testRowErrors(early.out).length, 1, early.out);
});

test("ID zadania w przewodniku poza „Historia zmian” nie wystarcza (T-117)", () => {
  const { out } = checkGit(repo({}), [["T-005: x", { "apps/api/test/a.test.ts": "t\n" }]]);
  assert.equal(testRowErrors(out).length, 1, out); // „T-005” stoi w „Pułapkach” fikstury
});

test("płytki klon (CI bez fetch-depth: 0) → ostrzeżenie, bez błędu (T-117)", () => {
  const { code, out } = checkGit(repo({}), [["T-005: x", { "apps/api/test/a.test.ts": "t\n" }]], {
    shallow: true,
  });
  assert.equal(code, 0, out);
  assert.match(out, /WARN\s+shallow git clone/, out);
});

// --write-index (T-116): zadanie z fixes/ nie ma epic ani story; puste pole w tabeli to „—”, jak w „Depends on”.
function writeIndex(files) {
  const dir = mkdtempSync(join(tmpdir(), "backlog-check-"));
  try {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
    execFileSync(process.execPath, [SCRIPT, "--root", "backlog", "--write-index"], {
      cwd: dir,
      encoding: "utf8",
    });
    return readFileSync(join(dir, "backlog", "index.md"), "utf8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("--write-index: wiersz zadania z fixes/ ma „—” w kolumnach Epic i Story, bez „undefined” (T-116 AC1, AC2)", () => {
  const index = writeIndex({
    ...epicFiles(null, { "backlog/fixes/T-002-a.md": fix("T-002", "Nic.") }),
  });
  const row = (id) => index.split("\n").find((l) => l.startsWith(`| [${id}]`));
  assert.equal(row("T-002"), "| [T-002](fixes/T-002-a.md) | Fix T-002 | — | — | done | — |");
  assert.equal(
    row("T-001"),
    "| [T-001](E-01-a/S-01-01-a/T-001-a.md) | Task T-001 | E-01 | S-01-01 | done | — |",
  );
  assert.doesNotMatch(index, /undefined/);
});
