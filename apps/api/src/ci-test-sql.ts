// ci-test T-002: celowe naruszenie TH-20 (lint ma zatrzymać ci-ok).
import { sql } from "drizzle-orm";

export function unsafe(input: string) {
  return sql.raw(`SELECT * FROM users WHERE name = '${input}'`);
}
