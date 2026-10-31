const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Identyfikator z adresu (UUID); inny tekst nie trafia do bazy ani do logu. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
