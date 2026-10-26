import type { HealthReadyResponse } from "@lista/shared";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../../test/msw-server";
import { renderWithApi } from "../../../test/render";
import { StartScreen } from "./StartScreen";

function apiAnswers(status: number, body: HealthReadyResponse) {
  server.use(http.get("*/health/ready", () => HttpResponse.json(body, { status })));
}

describe("StartScreen (AC4)", () => {
  it("shows the product name as the page heading", async () => {
    apiAnswers(200, { status: "ok", database: "up" });
    renderWithApi(<StartScreen />);

    expect(screen.getByRole("heading", { level: 1, name: "Wspólna lista zakupów" })).toBeVisible();
    expect(await screen.findByText("API działa · baza działa")).toBeVisible();
  });

  it("says that the API and the database work", async () => {
    apiAnswers(200, { status: "ok", database: "up" });
    renderWithApi(<StartScreen />);

    const status = screen.getByRole("status");
    expect(await screen.findByText("API działa · baza działa")).toBeVisible();
    expect(status).toHaveTextContent("API działa · baza działa");
  });

  it("says that the database is unavailable", async () => {
    apiAnswers(503, { status: "unavailable", database: "down" });
    renderWithApi(<StartScreen />);

    expect(await screen.findByText("API działa · baza niedostępna")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("API działa · baza niedostępna");
  });

  it("says that the API cannot be reached on a network error", async () => {
    server.use(http.get("*/health/ready", () => HttpResponse.error()));
    renderWithApi(<StartScreen />);

    expect(await screen.findByText("Brak połączenia z API")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Brak połączenia z API");
  });
});
