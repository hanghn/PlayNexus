// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import type { GuessView } from "@gamenite/shared";
import GuessGame from "./GuessGame";

afterEach(() => {
  cleanup();
});

const MOCK_PLAYERS = [
  { display: "Yāo", username: "yao", createdAt: new Date() },
  { display: "Flora", username: "flora", createdAt: new Date() },
];

const mockMakeMove = vi.fn();

describe("GuessGame win/loss UI", () => {
  it("shows You won when finished and user is winner", () => {
    const view: GuessView = {
      finished: true,
      secret: 50,
      guesses: [60, 49],
    };

    render(
      <GuessGame view={view} players={MOCK_PLAYERS} userPlayerIndex={1} makeMove={mockMakeMove} />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/You won/i);
    expect(alert).toHaveTextContent(/The secret was 50/i);
  });

  it("shows You lost when finished and user is not winner", () => {
    const view: GuessView = {
      finished: true,
      secret: 50,
      guesses: [49, 60],
    };

    render(
      <GuessGame view={view} players={MOCK_PLAYERS} userPlayerIndex={1} makeMove={mockMakeMove} />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/You lost/i);
    expect(alert).toHaveTextContent(/The secret was 50/i);
  });

  it("has aria-live assertive on game over message", () => {
    const view: GuessView = { finished: true, secret: 1, guesses: [1, 2] };
    render(
      <GuessGame view={view} players={MOCK_PLAYERS} userPlayerIndex={1} makeMove={mockMakeMove} />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
  });
});

describe("GuessGame waiting and input UI", () => {
  it("shows a waiting message when the player has already guessed", () => {
    const view: GuessView = { finished: false, guesses: [true, false], myGuess: 50 };
    render(
      <GuessGame view={view} players={MOCK_PLAYERS} userPlayerIndex={0} makeMove={mockMakeMove} />,
    );
    expect(screen.getByText(/Waiting for other players/i)).toBeInTheDocument();
  });

  it("form submit calls makeMove with the current guess", () => {
    const makeMove = vi.fn();
    const { container } = render(
      <GuessGame
        view={{ finished: false, guesses: [false, false] }}
        players={MOCK_PLAYERS}
        userPlayerIndex={0}
        makeMove={makeMove}
      />,
    );
    const form = container.querySelector(".gg-form") as HTMLFormElement;
    fireEvent.submit(form);
    expect(makeMove).toHaveBeenCalledWith(16);
  });

  it("range slider onChange updates the guess readout", () => {
    render(
      <GuessGame
        view={{ finished: false, guesses: [false, false] }}
        players={MOCK_PLAYERS}
        userPlayerIndex={0}
        makeMove={vi.fn()}
      />,
    );
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "75" } });
    expect(screen.getByText("75")).toBeInTheDocument();
  });
});
