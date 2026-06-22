// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useGameList from "./useGameList.ts";
import { gameList } from "../services/gameService.ts";

vi.mock("../services/gameService.ts", () => ({
  gameList: vi.fn(),
}));

const mockedGameList = vi.mocked(gameList);

const makeGame = (id: string) =>
  ({
    gameID: id,
  }) as unknown as Awaited<ReturnType<typeof gameList>>[number];

describe("useGameList", () => {
  beforeEach(() => {
    mockedGameList.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns Loading... message before the request resolves", () => {
    // Never-resolving promise to keep the hook in its initial state.
    mockedGameList.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useGameList());
    expect(result.current).toEqual({ message: "Loading..." });
  });

  it("returns the full list of games once resolved", async () => {
    const games = [makeGame("a"), makeGame("b"), makeGame("c")];
    mockedGameList.mockResolvedValue(games);

    const { result } = renderHook(() => useGameList());

    await waitFor(() => {
      expect(Array.isArray(result.current)).toBe(true);
    });
    expect(result.current).toEqual(games);
  });

  it("slices the list to maxGames when provided", async () => {
    const games = [makeGame("a"), makeGame("b"), makeGame("c")];
    mockedGameList.mockResolvedValue(games);

    const { result } = renderHook(() => useGameList(2));

    await waitFor(() => {
      expect(Array.isArray(result.current)).toBe(true);
    });
    expect(result.current).toEqual([games[0], games[1]]);
  });

  it("returns a 'No games found...' message for an empty list", async () => {
    mockedGameList.mockResolvedValue([]);

    const { result } = renderHook(() => useGameList());

    await waitFor(() => {
      expect(result.current).toEqual({ message: "No games found..." });
    });
  });

  it("returns an error message when the service rejects", async () => {
    mockedGameList.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useGameList());

    await waitFor(() => {
      expect(result.current).toEqual({ message: "Error: Error: boom" });
    });
  });
});
