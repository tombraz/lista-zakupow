import { GenericContainer, Wait } from "testcontainers";

/** Ten sam obraz co w `docker-compose.yml`. */
export const MAILPIT_IMAGE = "axllent/mailpit:v1.32.0";
const HTTP_PORT = 8025;

/**
 * Mailpit w kontenerze (adapter maili w testach, E2E): adres HTTP API i zatrzymanie. `hostPort`:
 * stały port na hoście, gdy adres musi znać inny proces (testy E2E czytają maile).
 */
export async function startMailpit(
  hostPort?: number,
): Promise<{ url: string; stop: () => Promise<void> }> {
  const container = await new GenericContainer(MAILPIT_IMAGE)
    .withExposedPorts(hostPort === undefined ? HTTP_PORT : { container: HTTP_PORT, host: hostPort })
    .withWaitStrategy(Wait.forHttp("/readyz", HTTP_PORT))
    .start();
  return {
    url: `http://${container.getHost()}:${String(container.getMappedPort(HTTP_PORT))}`,
    stop: async () => {
      await container.stop();
    },
  };
}
