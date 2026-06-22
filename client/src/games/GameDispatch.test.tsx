// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import GameDispatch from "./GameDispatch.tsx";

afterEach(cleanup);

const mockEmit = vi.fn();

vi.mock("../hooks/useLoginContext.ts", () => ({
  default: () => ({
    socket: { emit: mockEmit },
    user: { username: "yao", display: "Yāo", userId: "u1", createdAt: new Date() },
  }),
}));

vi.mock("../hooks/useAuth.ts", () => ({
  default: () => ({ username: "yao", password: "pwd" }),
}));

vi.mock("./NimGame.tsx", () => ({
  default: ({ makeMove }: { makeMove: (m: unknown) => void }) => (
    <button data-testid="nim-stub" onClick={() => makeMove("test-move")}>
      Nim
    </button>
  ),
}));

vi.mock("./GuessGame.tsx", () => ({
  default: () => <div data-testid="guess-stub" />,
}));

vi.mock("./CribbageGames.tsx", () => ({
  default: () => <div data-testid="cribbage-stub" />,
}));

const PLAYERS = [
  { display: "Yāo", username: "yao", createdAt: new Date() },
  { display: "Flora", username: "flora", createdAt: new Date() },
];

describe("GameDispatch", () => {
  it("renders NimGame for a nim view", () => {
    render(
      <GameDispatch
        view={{ type: "nim", view: {} as never }}
        userPlayerIndex={0}
        players={PLAYERS}
        gameId="g1"
      />,
    );
    expect(screen.getByTestId("nim-stub")).toBeInTheDocument();
  });

  it("renders GuessGame for a guess view", () => {
    render(
      <GameDispatch
        view={{ type: "guess", view: {} as never }}
        userPlayerIndex={0}
        players={PLAYERS}
        gameId="g2"
      />,
    );
    expect(screen.getByTestId("guess-stub")).toBeInTheDocument();
  });

  it("renders CribbageGame for a cribbage view", () => {
    render(
      <GameDispatch
        view={{ type: "cribbage", view: {} as never }}
        userPlayerIndex={0}
        players={PLAYERS}
        gameId="g3"
      />,
    );
    expect(screen.getByTestId("cribbage-stub")).toBeInTheDocument();
  });

  it("makeMove emits gameMakeMove with the correct payload", () => {
    mockEmit.mockClear();
    render(
      <GameDispatch
        view={{ type: "nim", view: {} as never }}
        userPlayerIndex={0}
        players={PLAYERS}
        gameId="game-42"
      />,
    );
    fireEvent.click(screen.getByTestId("nim-stub"));
    expect(mockEmit).toHaveBeenCalledWith(
      "gameMakeMove",
      expect.objectContaining({
        payload: expect.objectContaining({ gameId: "game-42", move: "test-move" }),
      }),
    );
  });
});
