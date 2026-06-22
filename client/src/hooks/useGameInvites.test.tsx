// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

// --- Mocks for external dependencies of the hook ---

const navigateMock = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

const useLoginContextMock = vi.fn();
vi.mock("./useLoginContext.ts", () => ({
  default: () => useLoginContextMock(),
}));

const useAuthMock = vi.fn();
vi.mock("./useAuth.ts", () => ({
  default: () => useAuthMock(),
}));

const getMyInvitationsMock = vi.fn();
const declineGameInviteMock = vi.fn();
vi.mock("../services/gameService.ts", () => ({
  getMyInvitations: (...args: unknown[]) => getMyInvitationsMock(...args),
  declineGameInvite: (...args: unknown[]) => declineGameInviteMock(...args),
}));

const announceMock = vi.fn();
vi.mock("../lib/liveAnnounce.ts", () => ({
  announce: (...args: unknown[]) => announceMock(...args),
}));

import type { GameInvitationInfo } from "@gamenite/shared";
import useGameInvites from "./useGameInvites.ts";

// A tiny fake socket that records handlers and lets tests fire events.
function makeFakeSocket() {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  return {
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      handlers.set(event, cb);
    }),
    off: vi.fn((event: string) => {
      handlers.delete(event);
    }),
    emit(event: string, payload: unknown) {
      handlers.get(event)?.(payload);
    },
    handlers,
  };
}

const invite = (overrides: Partial<GameInvitationInfo> = {}): GameInvitationInfo => ({
  gameId: "g1",
  gameType: "nim",
  toUsername: "alice",
  from: { username: "bob", display: "Bob", createdAt: new Date(0) },
  createdAt: new Date(0),
  ...overrides,
});

const declineInfo = (overrides: Record<string, unknown> = {}) => ({
  gameId: "g1",
  by: { username: "bob", display: "Bob" },
  inviterUsername: "alice",
  ...overrides,
});

describe("useGameInvites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ username: "alice", password: "pw" });
    getMyInvitationsMock.mockResolvedValue([]);
    declineGameInviteMock.mockResolvedValue({});
  });

  function setupContext(socket: unknown, username = "alice") {
    useLoginContextMock.mockReturnValue({ user: { username }, socket });
  }

  it("fetches offline invitations on mount and merges them", async () => {
    const socket = makeFakeSocket();
    setupContext(socket);
    getMyInvitationsMock.mockResolvedValue([invite(), invite({ gameId: "g2" })]);

    const { result } = renderHook(() => useGameInvites());

    await waitFor(() => expect(result.current.invites).toHaveLength(2));
    expect(getMyInvitationsMock).toHaveBeenCalledWith("alice");
  });

  it("does not fetch invitations when there is no username", () => {
    const socket = makeFakeSocket();
    setupContext(socket, "");

    renderHook(() => useGameInvites());

    expect(getMyInvitationsMock).not.toHaveBeenCalled();
  });

  it("swallows errors from the offline-invitation fetch", async () => {
    const socket = makeFakeSocket();
    setupContext(socket);
    getMyInvitationsMock.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useGameInvites());

    await waitFor(() => expect(getMyInvitationsMock).toHaveBeenCalled());
    expect(result.current.invites).toEqual([]);
  });

  it("adds an invite addressed to the user on a received socket event and announces it", async () => {
    const socket = makeFakeSocket();
    setupContext(socket);

    const { result } = renderHook(() => useGameInvites());
    await waitFor(() => expect(socket.handlers.has("gameInvitationReceived")).toBe(true));

    act(() => socket.emit("gameInvitationReceived", invite()));

    expect(result.current.invites).toHaveLength(1);
    expect(announceMock).toHaveBeenCalledWith("Bob invited you to a game.", true);
  });

  it("ignores received invites addressed to a different user", async () => {
    const socket = makeFakeSocket();
    setupContext(socket);

    const { result } = renderHook(() => useGameInvites());
    await waitFor(() => expect(socket.handlers.has("gameInvitationReceived")).toBe(true));

    act(() => socket.emit("gameInvitationReceived", invite({ toUsername: "someone-else" })));

    expect(result.current.invites).toHaveLength(0);
    expect(announceMock).not.toHaveBeenCalled();
  });

  it("dedupes a duplicate received invite (same gameId and sender)", async () => {
    const socket = makeFakeSocket();
    setupContext(socket);

    const { result } = renderHook(() => useGameInvites());
    await waitFor(() => expect(socket.handlers.has("gameInvitationReceived")).toBe(true));

    act(() => socket.emit("gameInvitationReceived", invite()));
    act(() => socket.emit("gameInvitationReceived", invite()));

    expect(result.current.invites).toHaveLength(1);
  });

  it("records a decline notice for the inviter", async () => {
    const socket = makeFakeSocket();
    setupContext(socket);

    const { result } = renderHook(() => useGameInvites());
    await waitFor(() => expect(socket.handlers.has("gameInviteDeclined")).toBe(true));

    act(() => socket.emit("gameInviteDeclined", declineInfo()));

    expect(result.current.declines).toHaveLength(1);
  });

  it("ignores a decline when the current user is the decliner", async () => {
    const socket = makeFakeSocket();
    setupContext(socket, "bob");

    const { result } = renderHook(() => useGameInvites());
    await waitFor(() => expect(socket.handlers.has("gameInviteDeclined")).toBe(true));

    act(() => socket.emit("gameInviteDeclined", declineInfo({ inviterUsername: "bob" })));

    expect(result.current.declines).toHaveLength(0);
  });

  it("ignores a decline when the current user is not the inviter", async () => {
    const socket = makeFakeSocket();
    setupContext(socket, "carol");

    const { result } = renderHook(() => useGameInvites());
    await waitFor(() => expect(socket.handlers.has("gameInviteDeclined")).toBe(true));

    act(() => socket.emit("gameInviteDeclined", declineInfo()));

    expect(result.current.declines).toHaveLength(0);
  });

  it("dedupes duplicate decline notices", async () => {
    const socket = makeFakeSocket();
    setupContext(socket);

    const { result } = renderHook(() => useGameInvites());
    await waitFor(() => expect(socket.handlers.has("gameInviteDeclined")).toBe(true));

    act(() => socket.emit("gameInviteDeclined", declineInfo()));
    act(() => socket.emit("gameInviteDeclined", declineInfo()));

    expect(result.current.declines).toHaveLength(1);
  });

  it("does not register socket handlers when socket is null", () => {
    setupContext(null);
    const { result } = renderHook(() => useGameInvites());
    expect(result.current.invites).toEqual([]);
  });

  it("cleans up socket listeners on unmount", async () => {
    const socket = makeFakeSocket();
    setupContext(socket);

    const { unmount } = renderHook(() => useGameInvites());
    await waitFor(() => expect(socket.handlers.has("gameInvitationReceived")).toBe(true));

    unmount();
    expect(socket.off).toHaveBeenCalledWith("gameInvitationReceived", expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith("gameInviteDeclined", expect.any(Function));
  });

  it("accept dismisses the invite and navigates to the game lobby with autoJoin", async () => {
    const socket = makeFakeSocket();
    setupContext(socket);

    const { result } = renderHook(() => useGameInvites());
    await waitFor(() => expect(socket.handlers.has("gameInvitationReceived")).toBe(true));
    act(() => socket.emit("gameInvitationReceived", invite()));
    expect(result.current.invites).toHaveLength(1);

    await act(async () => {
      await result.current.accept(invite());
    });

    expect(navigateMock).toHaveBeenCalledWith("/game/g1", { state: { autoJoin: true } });
    expect(result.current.invites).toHaveLength(0);
  });

  it("decline dismisses the invite and notifies the server", async () => {
    const socket = makeFakeSocket();
    setupContext(socket);

    const { result } = renderHook(() => useGameInvites());
    await waitFor(() => expect(socket.handlers.has("gameInvitationReceived")).toBe(true));
    act(() => socket.emit("gameInvitationReceived", invite()));

    await act(async () => {
      await result.current.decline(invite());
    });

    expect(declineGameInviteMock).toHaveBeenCalledWith(
      { username: "alice", password: "pw" },
      "g1",
      "bob",
    );
    expect(result.current.invites).toHaveLength(0);
  });

  it("decline swallows server errors but still dismisses locally", async () => {
    const socket = makeFakeSocket();
    setupContext(socket);
    declineGameInviteMock.mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useGameInvites());
    await waitFor(() => expect(socket.handlers.has("gameInvitationReceived")).toBe(true));
    act(() => socket.emit("gameInvitationReceived", invite()));

    await act(async () => {
      await result.current.decline(invite());
    });

    expect(result.current.invites).toHaveLength(0);
  });

  it("dismissDecline removes a matching decline notice", async () => {
    const socket = makeFakeSocket();
    setupContext(socket);

    const { result } = renderHook(() => useGameInvites());
    await waitFor(() => expect(socket.handlers.has("gameInviteDeclined")).toBe(true));
    act(() => socket.emit("gameInviteDeclined", declineInfo()));
    expect(result.current.declines).toHaveLength(1);

    act(() => result.current.dismissDecline("g1", "bob"));
    expect(result.current.declines).toHaveLength(0);
  });
});
