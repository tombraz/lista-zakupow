import { readDatabaseUrl } from "../config";
import { migrateDatabase } from "./migrate";

await migrateDatabase(readDatabaseUrl(process.env), {
  log: (message) => {
    console.log(message);
  },
});
console.log("migrations applied");
