import type { ListEvent } from "@lista/shared";
import type { FastifyBaseLogger } from "fastify";
import { afterCommit } from "../../../http/after-commit";
import { everyone, type Lists } from "../../listy";
import type { Live } from "../../na-zywo";

/**
 * F-14: zdarzenie pozycji do kanału listy i `lists.changed` (SC-05: „N do kupienia”, kolejność)
 * do wszystkich z dostępem. Wołane dopiero po zatwierdzeniu zmiany (repozytorium kończy
 * transakcję, zanim domena zwróci wynik), więc wycofana zmiana niczego nie rozsyła; błąd
 * rozesłania tylko do logu żądania (`afterCommit`, T-089).
 */
export function itemEvents(live: Live, lists: Pick<Lists, "peopleWithAccess">) {
  return (log: FastifyBaseLogger, event: ListEvent) =>
    afterCommit(log, async () => {
      live.publish(event);
      live.notify(everyone(await lists.peopleWithAccess(event.listId)), { type: "lists.changed" });
    });
}
