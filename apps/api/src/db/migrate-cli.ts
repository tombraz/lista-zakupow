import { readDatabaseUrl } from "../config";
import { runMigrations } from "./migrate";
import { createPool } from "./pool";

const pool = createPool(readDatabaseUrl(process.env));
try {
  await runMigrations(pool);
  console.log("migrations applied");
} finally {
  await pool.end();
}
