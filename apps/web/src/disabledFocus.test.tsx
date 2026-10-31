import { render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

function Toggle({ inFieldset = false }: { inFieldset?: boolean }) {
  const [disabled, setDisabled] = useState(false);
  const button = (
    <button
      type="button"
      disabled={!inFieldset && disabled}
      onClick={() => {
        setDisabled(true);
      }}
    >
      Wyłącz
    </button>
  );
  return inFieldset ? <fieldset disabled={disabled}>{button}</fieldset> : button;
}

// Atrapa z `test/setup.ts` (T-023): jak przeglądarka, fokus z elementu `disabled` spada na `body`.
describe("focus on a control that becomes disabled (test setup)", () => {
  it("falls to body when the focused button gets disabled", async () => {
    render(<Toggle />);
    const button = screen.getByRole("button", { name: "Wyłącz" });
    button.focus();

    button.click();

    await waitFor(() => {
      expect(document.activeElement).toBe(document.body);
    });
  });

  it("falls to body when the fieldset around the focused button gets disabled", async () => {
    render(<Toggle inFieldset />);
    const button = screen.getByRole("button", { name: "Wyłącz" });
    button.focus();

    button.click();

    await waitFor(() => {
      expect(document.activeElement).toBe(document.body);
    });
  });
});
