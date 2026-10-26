import { Writable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { securityLog } from "../src/logging";
import { useTestDatabase } from "./database";

const SECRETS = {
  authorization: "Bearer secret-authorization-value",
  cookie: "better-auth.session_token=secret-cookie-value",
  password: "secret-password-value",
  token: "secret-token-value",
};

function captureLogs() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(...chunk.toString("utf8").split("\n").filter(Boolean));
      done();
    },
  });
  const entries = () => lines.map((line) => JSON.parse(line) as Record<string, unknown>);
  return { stream, lines, entries };
}

describe("logging (SEC2: TH-21)", () => {
  const db = useTestDatabase();
  const logs = captureLogs();
  const app = () => buildApp({ pool: db.pool, logger: { level: "info", stream: logs.stream } });
  let current: ReturnType<typeof app> | undefined;

  afterEach(async () => {
    await current?.close();
    logs.lines.length = 0;
  });

  it("never writes authorization, cookie, password or token values", async () => {
    current = app();
    await current.inject({
      method: "POST",
      url: "/health",
      headers: { authorization: SECRETS.authorization, cookie: SECRETS.cookie },
      payload: { email: "a@example.com", password: SECRETS.password, token: SECRETS.token },
    });
    current.log.info({ user: { password: SECRETS.password }, token: SECRETS.token }, "probe");
    current.log.info(
      { req: { headers: { authorization: SECRETS.authorization, cookie: SECRETS.cookie } } },
      "probe",
    );

    expect(logs.lines.length).toBeGreaterThan(0);
    const all = logs.lines.join("\n");
    for (const value of Object.values(SECRETS)) expect(all).not.toContain(value);
  });

  it("adds requestId to every entry written while handling a request", async () => {
    current = app();
    await current.inject({ method: "GET", url: "/health" });

    const requestEntries = logs.entries().filter((entry) => "req" in entry || "res" in entry);
    expect(requestEntries.length).toBeGreaterThanOrEqual(2);
    for (const entry of requestEntries) expect(entry["requestId"]).toEqual(expect.any(String));
  });

  it("offers a security channel with the same redaction", () => {
    current = app();

    securityLog(current.log).warn({ userId: "u-1", password: SECRETS.password }, "sign-in failed");

    const entry = logs.entries().find((e) => e["msg"] === "sign-in failed");
    expect(entry?.["channel"]).toBe("security");
    expect(JSON.stringify(entry)).not.toContain(SECRETS.password);
  });
});
