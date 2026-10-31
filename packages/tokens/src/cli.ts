import { fileURLToPath } from "node:url";
import { buildTokens } from "./build";

await buildTokens({
  source: fileURLToPath(new URL("../../../docs/design/tokens.json", import.meta.url)),
  outDir: fileURLToPath(new URL("../generated", import.meta.url)),
});
