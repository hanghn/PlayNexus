// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import NimGame from "./NimGame";

afterEach(() => {
  cleanup();
});

const MOCK_PLAYERS = [
  { display: "Yāo", username: "yao", createdAt: new Date() },
  { display: "Flora", username: "flora", createdAt: new Date() },
];

const mockMakeMove = vi.fn();

describe("NimGame win/loss UI", () => {
  it("shows You lost when game over and user is not winner", () => {
    render(
      <NimGame
        view={{ remaining: 0, nextPlayer: 0 }}
        players={MOCK_PLAYERS}
        userPlayerIndex={1}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByText(/😔 You lost\./i)).toBeTruthy();
  });

  it("shows You won when game over and user is winner", () => {
    render(
      <NimGame
        view={{ remaining: 0, nextPlayer: 1 }}
        players={MOCK_PLAYERS}
        userPlayerIndex={1}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByText(/🎉 You won!/i)).toBeTruthy();
  });

  it("has aria-live assertive on game over message", () => {
    render(
      <NimGame
        view={{ remaining: 0, nextPlayer: 0 }}
        players={MOCK_PLAYERS}
        userPlayerIndex={1}
        makeMove={mockMakeMove}
      />,
    );
    const alerts = screen.getAllByRole("alert");
    expect(alerts.length).toBeGreaterThan(0);
  });
});

describe("NimGame in-progress UI", () => {
  it("renders nim-token elements for each remaining object", () => {
    const { container } = render(
      <NimGame
        view={{ remaining: 5, nextPlayer: 0 }}
        players={MOCK_PLAYERS}
        userPlayerIndex={0}
        makeMove={mockMakeMove}
      />,
    );
    expect(container.querySelectorAll(".nim-token")).toHaveLength(5);
  });

  it("shows 'your turn' when it is the user's turn", () => {
    render(
      <NimGame
        view={{ remaining: 3, nextPlayer: 0 }}
        players={MOCK_PLAYERS}
        userPlayerIndex={0}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByText("your turn")).toBeInTheDocument();
  });

  it("shows opponent display name's turn via playerPoss when disabled", () => {
    render(
      <NimGame
        view={{ remaining: 3, nextPlayer: 1 }}
        players={MOCK_PLAYERS}
        userPlayerIndex={0}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByText(/Flora's turn/)).toBeInTheDocument();
  });

  it("renders Take 1, 2, 3 buttons on the user's turn", () => {
    render(
      <NimGame
        view={{ remaining: 5, nextPlayer: 0 }}
        players={MOCK_PLAYERS}
        userPlayerIndex={0}
        makeMove={mockMakeMove}
      />,
    );
    expect(screen.getByRole("button", { name: /Take 1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Take 2/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Take 3/i })).toBeInTheDocument();
  });

  it("clicking Take 1 button calls makeMove(1)", () => {
    const makeMove = vi.fn();
    render(
      <NimGame
        view={{ remaining: 5, nextPlayer: 0 }}
        players={MOCK_PLAYERS}
        userPlayerIndex={0}
        makeMove={makeMove}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Take 1/i }));
    expect(makeMove).toHaveBeenCalledWith(1);
  });

  it("keyboard '1' calls makeMove(1) on user's turn", () => {
    const makeMove = vi.fn();
    render(
      <NimGame
        view={{ remaining: 5, nextPlayer: 0 }}
        players={MOCK_PLAYERS}
        userPlayerIndex={0}
        makeMove={makeMove}
      />,
    );
    fireEvent.keyDown(window, { key: "1" });
    expect(makeMove).toHaveBeenCalledWith(1);
  });

  it("keyboard '2' calls makeMove(2) on user's turn", () => {
    const makeMove = vi.fn();
    render(
      <NimGame
        view={{ remaining: 5, nextPlayer: 0 }}
        players={MOCK_PLAYERS}
        userPlayerIndex={0}
        makeMove={makeMove}
      />,
    );
    fireEvent.keyDown(window, { key: "2" });
    expect(makeMove).toHaveBeenCalledWith(2);
  });

  it("keyboard '3' calls makeMove(3) on user's turn", () => {
    const makeMove = vi.fn();
    render(
      <NimGame
        view={{ remaining: 5, nextPlayer: 0 }}
        players={MOCK_PLAYERS}
        userPlayerIndex={0}
        makeMove={makeMove}
      />,
    );
    fireEvent.keyDown(window, { key: "3" });
    expect(makeMove).toHaveBeenCalledWith(3);
  });
});
