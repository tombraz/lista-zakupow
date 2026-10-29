import { readDatabaseUrl } from "../config";
import { migrateDatabase } from "./migrate";

await migrateDatabase(readDatabaseUrl(process.env));
console.log("migrations applied");
