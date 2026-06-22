// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import GuessGame from "./GuessGame";

afterEach(() => {
  cleanup();
});

const MOCK_PLAYERS = [
  { display: "Yāo", username: "yao", createdAt: new Date() },
  { display: "Flora", username: "flora", createdAt: new Date() },
];

describe("GuessGame keyboard shortcuts", () => {
  it("ArrowRight increases the guess", () => {
    render(
      <GuessGame
        view={{
          finished: false,
          guesses: [false, false],
        }}
        players={MOCK_PLAYERS}
        userPlayerIndex={0}
        makeMove={vi.fn()}
      />,
    );
    // Default guess is 16; ArrowRight bumps the live readout to 17.
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("17")).toBeInTheDocument();
  });

  it("Enter calls makeMove with current guess", () => {
    const makeMove = vi.fn();
    render(
      <GuessGame
        view={{
          finished: false,
          guesses: [false, false],
        }}
        players={MOCK_PLAYERS}
        userPlayerIndex={0}
        makeMove={makeMove}
      />,
    );
    fireEvent.keyDown(window, { key: "Enter" });
    expect(makeMove).toHaveBeenCalledWith(16);
  });

  it("Enter does not fire when player has already guessed", () => {
    const makeMove = vi.fn();
    render(
      <GuessGame
        view={{
          finished: false,
          guesses: [true, false],
          myGuess: 50,
        }}
        players={MOCK_PLAYERS}
        userPlayerIndex={0}
        makeMove={makeMove}
      />,
    );
    fireEvent.keyDown(window, { key: "Enter" });
    expect(makeMove).not.toHaveBeenCalled();
  });

  it("ArrowUp increases the guess", () => {
    render(
      <GuessGame
        view={{ finished: false, guesses: [false, false] }}
        players={MOCK_PLAYERS}
        userPlayerIndex={0}
        makeMove={vi.fn()}
      />,
    );
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(screen.getByText("17")).toBeInTheDocument();
  });

  it("ArrowDown decreases the guess", () => {
    render(
      <GuessGame
        view={{ finished: false, guesses: [false, false] }}
        players={MOCK_PLAYERS}
        userPlayerIndex={0}
        makeMove={vi.fn()}
      />,
    );
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("ArrowLeft decreases the guess", () => {
    render(
      <GuessGame
        view={{ finished: false, guesses: [false, false] }}
        players={MOCK_PLAYERS}
        userPlayerIndex={0}
        makeMove={vi.fn()}
      />,
    );
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("Enter on a focused button activates the button instead of the direct submit path", () => {
    const makeMove = vi.fn();
    render(
      <GuessGame
        view={{ finished: false, guesses: [false, false] }}
        players={MOCK_PLAYERS}
        userPlayerIndex={0}
        makeMove={makeMove}
      />,
    );
    const button = screen.getByRole("button", { name: /Submit guess/i });
    const clickSpy = vi.spyOn(button, "click");
    button.focus();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(clickSpy).toHaveBeenCalled();
  });
});
