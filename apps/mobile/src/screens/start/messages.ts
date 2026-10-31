import type { ApiStatus } from "../../api/health";

export const messages = {
  title: "Wspólna lista zakupów",
  checking: "Sprawdzam połączenie…",
  statusLabel: "Stan serwera",
  status: {
    ready: "API działa · baza działa",
    "database-down": "API działa · baza niedostępna",
    unreachable: "Nie można połączyć się z serwerem",
  } satisfies Record<ApiStatus, string>,
};
