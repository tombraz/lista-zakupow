import type { SyntheticEvent } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

// T-015: w czasie zapisu przycisk zostaje fokusowalny (aria-disabled), ale nic nie robi.
describe("Button loading", () => {
  it("keeps focus and announces busy and unavailable instead of becoming disabled", () => {
    const { rerender } = render(<Button writes={false}>Usuń</Button>);
    const button = screen.getByRole("button", { name: "Usuń" });
    button.focus();

    rerender(
      <Button writes={false} loading>
        Usuń
      </Button>,
    );

    expect(button).toHaveFocus();
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("ignores clicks, Enter and Space while loading", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button writes={false} loading onClick={onClick}>
        Usuń
      </Button>,
    );

    await user.click(screen.getByRole("button", { name: "Usuń" }));
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not submit its form while loading, also by Enter in a field", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: SyntheticEvent) => {
      event.preventDefault();
    });
    render(
      <form onSubmit={onSubmit}>
        <input aria-label="Nazwa" />
        <Button writes={false} type="submit" loading>
          Zapisz
        </Button>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    await user.type(screen.getByRole("textbox", { name: "Nazwa" }), "Dom{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("stays really disabled when disabled is passed", () => {
    render(
      <Button writes={false} disabled>
        Zapisz
      </Button>,
    );

    expect(screen.getByRole("button", { name: "Zapisz" })).toBeDisabled();
  });
});
