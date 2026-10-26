import { readConfig } from "../config";
import { runMigrations } from "./migrate";
import { createPool } from "./pool";

const pool = createPool(readConfig(process.env).DATABASE_URL);
try {
  await runMigrations(pool);
  console.log("migrations applied");
} finally {
  await pool.end();
}
