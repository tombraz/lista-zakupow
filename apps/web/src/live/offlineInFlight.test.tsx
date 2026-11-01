import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { heldResponse } from "../../test/held";
import { aList, anItem, ANIA, detailsOf, listsAre } from "../../test/lists";
import { browserGoes, liveServer } from "../../test/live";
import { server } from "../../test/msw-server";
import { renderApp, sessionIs } from "../../test/render";

const NETWORK = "Brak połączenia. Sprawdź internet i spróbuj ponownie.";
const LIST = aList({ name: "Dom" });
const BREAD = anItem({ name: "Chleb" });

const toBuy = () => within(screen.getByRole("list", { name: "Do kupienia" }));

/** SC-06 z „Chleb”; zapisy (POST, PATCH) wstrzymane i zrywane błędem sieci. */
async function openListWithHeldWrites() {
  const user = userEvent.setup();
  const live = liveServer();
  const response = heldResponse();
  const writes: string[] = [];
  const failInFlight = async ({ request }: { request: Request }) => {
    writes.push(request.method);
    await response.released;
    return HttpResponse.error();
  };
  server.use(
    http.get(`*/api/v1/lists/${LIST.id}`, () => HttpResponse.json(detailsOf(LIST, [BREAD]))),
    http.post(`*/api/v1/lists/${LIST.id}/items`, failInFlight),
    http.patch(`*/api/v1/lists/${LIST.id}/items/:itemId`, failInFlight),
  );
  listsAre([LIST]);
  renderApp(`/listy/${LIST.id}`);
  await screen.findByText("1 do kupienia");
  return { user, live, response, writes };
}

// AC3 (F-15: bez połączenia zmiana nie jest pokazana jako zapisana; bez kolejki).
describe("a write cut off by the connection drop", () => {
  beforeEach(() => {
    sessionIs(ANIA);
  });

  it("does not show the added item, shows the network error and does not send it again", async () => {
    const { user, response, writes } = await openListWithHeldWrites();

    await user.type(screen.getByRole("textbox", { name: "Co kupić?" }), "Masło{Enter}");
    await waitFor(() => {
      expect(writes).toEqual(["POST"]);
    });
    browserGoes("offline");
    response.release();

    expect(await screen.findByText(NETWORK)).toBeInTheDocument();
    expect(toBuy().queryByRole("button", { name: "Edytuj Masło" })).not.toBeInTheDocument();
    expect(screen.getByText("1 do kupienia")).toBeInTheDocument();

    browserGoes("online");
    await screen.findByText("1 do kupienia");
    expect(writes).toEqual(["POST"]);
  });

  it("puts the checkbox back when the check does not reach the server", async () => {
    const { user, response, writes } = await openListWithHeldWrites();

    await user.click(toBuy().getByRole("button", { name: "Odhacz Chleb" }));
    browserGoes("offline");
    response.release();

    expect(await screen.findByText(NETWORK)).toBeInTheDocument();
    const checkbox = toBuy().getByRole("button", { name: "Odhacz Chleb" });
    expect(checkbox).toHaveAttribute("aria-pressed", "false");
    expect(checkbox).not.toHaveAttribute("aria-busy");
    browserGoes("online");
    expect(writes).toEqual(["PATCH"]);
  });
});
