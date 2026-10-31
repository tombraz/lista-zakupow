import { afterEach, describe, expect, it, jest } from "@jest/globals";
import type { HealthReadyResponse } from "@lista/shared";
import { act, screen } from "@testing-library/react-native";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/msw-server";
import { renderWithApi } from "../../../test/render";
import { StartScreen } from "./StartScreen";

function apiAnswers(status: number, body: HealthReadyResponse) {
  server.use(http.get("*/health/ready", () => HttpResponse.json(body, { status })));
}

describe("StartScreen (AC1)", () => {
  it("shows the product name as the screen header", async () => {
    apiAnswers(200, { status: "ok", database: "up" });
    await renderWithApi(<StartScreen />);

    expect(screen.getByRole("header", { name: "Wspólna lista zakupów" })).toBeOnTheScreen();
    expect(await screen.findByText("API działa · baza działa")).toBeOnTheScreen();
  });

  it("says that the API and the database work", async () => {
    apiAnswers(200, { status: "ok", database: "up" });
    await renderWithApi(<StartScreen />);

    expect(
      await screen.findByRole("text", { name: "Stan serwera: API działa · baza działa" }),
    ).toBeOnTheScreen();
  });

  it("says that the database is unavailable", async () => {
    apiAnswers(503, { status: "unavailable", database: "down" });
    await renderWithApi(<StartScreen />);

    expect(
      await screen.findByRole("text", { name: "Stan serwera: API działa · baza niedostępna" }),
    ).toBeOnTheScreen();
    expect(screen.getByText("API działa · baza niedostępna")).toBeOnTheScreen();
  });

  it("says that the server cannot be reached on a network error", async () => {
    server.use(http.get("*/health/ready", () => HttpResponse.error()));
    await renderWithApi(<StartScreen />);

    expect(
      await screen.findByRole("text", { name: "Stan serwera: Nie można połączyć się z serwerem" }),
    ).toBeOnTheScreen();
    expect(screen.getByText("Nie można połączyć się z serwerem")).toBeOnTheScreen();
  });

  describe("when the server is not reachable yet", () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it("checks again until the API answers", async () => {
      jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
      apiAnswers(200, { status: "ok", database: "up" });
      server.use(http.get("*/health/ready", () => HttpResponse.error(), { once: true }));
      await renderWithApi(<StartScreen />);
      expect(await screen.findByText("Nie można połączyć się z serwerem")).toBeOnTheScreen();

      await act(() => jest.advanceTimersByTimeAsync(5000));

      expect(await screen.findByText("API działa · baza działa")).toBeOnTheScreen();
    });
  });
});
