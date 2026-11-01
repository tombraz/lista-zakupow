import { GenericContainer, Wait } from "testcontainers";

/** Ten sam obraz co w `docker-compose.yml`. */
export const MAILPIT_IMAGE = "axllent/mailpit:v1.32.0";
const HTTP_PORT = 8025;

/** Mailpit w kontenerze (adapter maili w testach, E2E): adres HTTP API i zatrzymanie. */
export async function startMailpit(): Promise<{ url: string; stop: () => Promise<void> }> {
  const container = await new GenericContainer(MAILPIT_IMAGE)
    .withExposedPorts(HTTP_PORT)
    .withWaitStrategy(Wait.forHttp("/readyz", HTTP_PORT))
    .start();
  return {
    url: `http://${container.getHost()}:${String(container.getMappedPort(HTTP_PORT))}`,
    stop: async () => {
      await container.stop();
    },
  };
}
