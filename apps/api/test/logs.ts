import { Writable } from "node:stream";

/** Strumień logów pino do sprawdzania wpisów w testach. */
export function captureLogs() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(...chunk.toString("utf8").split("\n").filter(Boolean));
      done();
    },
  });
  const entries = () => lines.map((line) => JSON.parse(line) as Record<string, unknown>);
  const security = () => entries().filter((entry) => entry["channel"] === "security");
  return { stream, lines, entries, security };
}
