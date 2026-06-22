// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { SafeUserInfo } from "@gamenite/shared";

const player = (username: string): SafeUserInfo => ({
  username,
  display: username,
  createdAt: new Date(),
});

const useLoginContext = vi.fn();
const useAuth = vi.fn();

vi.mock("./useLoginContext.ts", () => ({ default: () => useLoginContext() }));
vi.mock("./useAuth.ts", () => ({ default: () => useAuth() }));

import useSocketsForGame from "./useSocketsForGame.ts";

type Handler = (...args: unknown[]) => void;

/** Minimal Socket.IO stand-in: on/off manage handlers, trigger replays an
 *  inbound event, emit is a spy for outbound messages. */
function makeSocket() {
  const handlers: Record<string, Handler[]> = {};
  return {
    on: vi.fn((event: string, cb: Handler) => {
      (handlers[event] ??= []).push(cb);
    }),
    off: vi.fn((event: string, cb: Handler) => {
      handlers[event] = (handlers[event] ?? []).filter((h) => h !== cb);
    }),
    emit: vi.fn(),
    trigger: (event: string, payload: unknown) =>
      (handlers[event] ?? []).forEach((h) => h(payload)),
  };
}

const auth = { username: "bob", password: "pw" };

describe("useSocketsForGame", () => {
  let socket: ReturnType<typeof makeSocket>;

  beforeEach(() => {
    socket = makeSocket();
    useAuth.mockReturnValue(auth);
    useLoginContext.mockReturnValue({ user: { username: "bob" }, socket });
  });

  it("subscribes to every game event and emits gameWatch on mount", () => {
    renderHook(() => useSocketsForGame("g1", []));
    const events = socket.on.mock.calls.map((c) => c[0]);
    expect(events).toEqual(
      expect.arrayContaining([
        "gameWatched",
        "gamePlayersUpdated",
        "gameStateUpdated",
        "gameError",
        "gameNotice",
      ]),
    );
    expect(socket.emit).toHaveBeenCalledWith("gameWatch", { auth, payload: "g1" });
  });

  it("sets hasWatched and stores players/view when gameWatched fires for this game", () => {
    const players = [{ username: "bob" }, { username: "amy" }];
    const view = { kind: "cribbage", forPlayer: true };
    const { result } = renderHook(() => useSocketsForGame("g1", []));
    act(() => socket.trigger("gameWatched", { gameId: "g1", players, view }));
    expect(result.current.hasWatched).toBe(true);
    expect(result.current.players).toEqual(players);
    expect(result.current.view).toEqual(view);
    expect(result.current.userPlayerIndex).toBe(0);
  });

  it("ignores gameWatched for a different game id", () => {
    const { result } = renderHook(() => useSocketsForGame("g1", []));
    act(() => socket.trigger("gameWatched", { gameId: "OTHER", players: [], view: {} }));
    expect(result.current.hasWatched).toBe(false);
  });

  it("updates players (clearing error) and surfaces errors/notices", () => {
    const { result } = renderHook(() => useSocketsForGame("g1", []));
    act(() => socket.trigger("gameError", { action: "join", message: "nope" }));
    expect(result.current.gameError).toBe("nope");

    act(() => socket.trigger("gamePlayersUpdated", [{ username: "z" }]));
    expect(result.current.players).toEqual([{ username: "z" }]);
    expect(result.current.gameError).toBeNull();

    act(() => socket.trigger("gameNotice", { message: "your turn" }));
    expect(result.current.notice).toBe("your turn");
  });

  it("emits join / leave / start with auth and gameId", () => {
    const { result } = renderHook(() => useSocketsForGame("g7", []));
    socket.emit.mockClear();
    act(() => result.current.joinGame());
    act(() => result.current.leaveGame());
    act(() => result.current.startGame());
    expect(socket.emit).toHaveBeenCalledWith("gameJoinAsPlayer", { auth, payload: "g7" });
    expect(socket.emit).toHaveBeenCalledWith("gameLeave", { auth, payload: "g7" });
    expect(socket.emit).toHaveBeenCalledWith("gameStart", { auth, payload: "g7" });
  });

  it("unsubscribes from all events on unmount", () => {
    const { unmount } = renderHook(() => useSocketsForGame("g1", []));
    unmount();
    const offEvents = socket.off.mock.calls.map((c) => c[0]);
    expect(offEvents).toEqual(
      expect.arrayContaining([
        "gameWatched",
        "gamePlayersUpdated",
        "gameStateUpdated",
        "gameError",
        "gameNotice",
      ]),
    );
  });

  it("applies a gameStateUpdated view for a watcher (not a seated player)", () => {
    const { result } = renderHook(() => useSocketsForGame("g1", [player("amy")]));
    const view = { type: "nim", forPlayer: false };
    act(() => socket.trigger("gameStateUpdated", view));
    expect(result.current.view).toEqual(view);
  });

  it("ignores a watcher view for a seated player but applies their own", () => {
    // bob is player #0, so a forPlayer:false (spectator) view must be ignored...
    const { result } = renderHook(() => useSocketsForGame("g1", [player("bob")]));
    act(() => socket.trigger("gameStateUpdated", { type: "nim", forPlayer: false }));
    expect(result.current.view).toBeNull();

    // ...while a forPlayer:true view is applied.
    const playerView = { type: "nim", forPlayer: true };
    act(() => socket.trigger("gameStateUpdated", playerView));
    expect(result.current.view).toEqual(playerView);
  });

  it("ignores a null gameStateUpdated payload", () => {
    const { result } = renderHook(() => useSocketsForGame("g1", [player("amy")]));
    act(() => socket.trigger("gameStateUpdated", null));
    expect(result.current.view).toBeNull();
  });
});
