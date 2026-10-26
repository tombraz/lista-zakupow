// Ten sam obraz co w docker-compose.yml.
export const POSTGRES_IMAGE = "postgres:17.11-alpine";
export const TEMPLATE_DATABASE = "lista_template";
export function databaseUrl(adminUrl: string, database: string): string {
  const url = new URL(adminUrl);
  url.pathname = `/${database}`;
  return url.toString();
}
