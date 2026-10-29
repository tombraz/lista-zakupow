import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";
import { runMigrations } from "../src/db/migrate";
import { createPool } from "../src/db/pool";
import { databaseUrl, POSTGRES_IMAGE, TEMPLATE_DATABASE } from "./database-constants";

declare module "vitest" {
  export interface ProvidedContext {
    postgresAdminUrl: string;
  }
}

let container: StartedPostgreSqlContainer | undefined;

const NO_DURABILITY = ["fsync", "synchronous_commit", "full_page_writes"].flatMap((setting) => [
  "-c",
  `${setting}=off`,
]);

export async function setup(project: TestProject): Promise<void> {
  // Baza testów jest jednorazowa: bez trwałości zapisu (fsync) tworzenie baz i commity są
  // kilka razy szybsze (T-021).
  container = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withCommand(["postgres", ...NO_DURABILITY])
    .start();
  const admin = createPool(container.getConnectionUri());
  await admin.query(`CREATE DATABASE ${TEMPLATE_DATABASE}`);
  await admin.end();

  const template = createPool(databaseUrl(container.getConnectionUri(), TEMPLATE_DATABASE));
  await runMigrations(template);
  // Baza-szablon nie może mieć otwartych połączeń przy CREATE DATABASE … TEMPLATE.
  await template.end();

  project.provide("postgresAdminUrl", container.getConnectionUri());
}

export async function teardown(): Promise<void> {
  await container?.stop();
}
