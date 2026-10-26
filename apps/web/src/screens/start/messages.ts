import type { ApiStatus } from "../../api/health";

export const messages = {
  title: "Wspólna lista zakupów",
  checking: "Sprawdzam połączenie…",
  status: {
    ready: "API działa · baza działa",
    "database-down": "API działa · baza niedostępna",
    unreachable: "Brak połączenia z API",
  } satisfies Record<ApiStatus, string>,
};
