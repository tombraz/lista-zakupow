import { readFileSync } from "node:fs";

// Jedno źródło tagu obrazu: docker-compose.yml (używają go też Testcontainers w E2E i CI).
function composePostgresImage(): string {
  const compose = readFileSync(new URL("../../../docker-compose.yml", import.meta.url), "utf8");
  const image = /^\s+image:\s*(postgres:\S+)\s*$/m.exec(compose)?.[1];
  if (image === undefined) throw new Error("docker-compose.yml: brak obrazu postgres");
  return image;
}

export const POSTGRES_IMAGE = composePostgresImage();
export const TEMPLATE_DATABASE = "lista_template";
export function databaseUrl(adminUrl: string, database: string): string {
  const url = new URL(adminUrl);
  url.pathname = `/${database}`;
  return url.toString();
}
