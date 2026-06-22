// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as matchers from "@testing-library/jest-dom/matchers";
import type { FriendshipInfo, SafeUserInfo } from "@gamenite/shared";

expect.extend(matchers);

// ---- mocks for hooks the page consumes ----
const navigate = vi.fn();
const useLoginContext = vi.fn();
const useFriends = vi.fn();
const useOnlineStatus = vi.fn();
const useAuth = vi.fn();

// service mocks
const openDMThread = vi.fn();
const createGame = vi.fn();
const sendGameInvite = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("../hooks/useLoginContext.ts", () => ({ default: () => useLoginContext() }));
vi.mock("../hooks/useFriends.ts", () => ({ default: () => useFriends() }));
vi.mock("../hooks/useOnlinestatus.ts", () => ({ default: () => useOnlineStatus() }));
vi.mock("../hooks/useAuth.ts", () => ({ default: () => useAuth() }));

vi.mock("../services/dmService.ts", () => ({
  openDMThread: (...a: unknown[]) => openDMThread(...a),
}));
vi.mock("../services/gameService.ts", () => ({
  createGame: (...a: unknown[]) => createGame(...a),
  sendGameInvite: (...a: unknown[]) => sendGameInvite(...a),
}));
vi.mock("../services/api.ts", () => ({
  apiErrorMessage: (_err: unknown, fallback: string) => fallback,
}));
vi.mock("./Friends.css", () => ({}));

import Friends from "./Friends.tsx";

const ME: SafeUserInfo = {
  username: "me",
  display: "Me",
} as unknown as SafeUserInfo;

function makeUser(username: string, extra: Partial<SafeUserInfo> = {}): SafeUserInfo {
  return { username, display: username.toUpperCase(), ...extra } as unknown as SafeUserInfo;
}

function fs(
  id: string,
  from: SafeUserInfo,
  to: SafeUserInfo,
  status: FriendshipInfo["status"],
): FriendshipInfo {
  return { friendshipId: id, from, to, status } as unknown as FriendshipInfo;
}

const sendRequest = vi.fn();
const respond = vi.fn();
const remove = vi.fn();

function setFriends(friendships: FriendshipInfo[] | null, error: string | null = null) {
  useFriends.mockReturnValue({ friendships, error, sendRequest, respond, remove });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <Friends />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useLoginContext.mockReturnValue({ user: ME });
  useAuth.mockReturnValue({ username: "me", password: "pw" });
  useOnlineStatus.mockReturnValue({ onlineUsers: new Set<string>() });
  setFriends([]);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
});

describe("Friends page", () => {
  it("shows the error state when useFriends reports an error", () => {
    setFriends(null, "Boom");
    renderPage();
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });

  it("shows a loading state while friendships are null", () => {
    setFriends(null);
    renderPage();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders the empty friends state with zero count", () => {
    setFriends([]);
    renderPage();
    expect(screen.getByText(/No friends yet/)).toBeInTheDocument();
    expect(screen.getByText(/0 friends/)).toBeInTheDocument();
  });

  it("sends a friend request and shows the success message", async () => {
    sendRequest.mockResolvedValue(undefined);
    renderPage();
    const input = screen.getByLabelText("Add a friend by username");
    const addBtn = screen.getByRole("button", { name: "Add" });
    expect(addBtn).toBeDisabled();

    fireEvent.change(input, { target: { value: "  bob  " } });
    expect(addBtn).toBeEnabled();
    fireEvent.click(addBtn);

    await waitFor(() => expect(sendRequest).toHaveBeenCalledWith("bob"));
    expect(await screen.findByText("Friend request sent to bob")).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("shows an error message when sending a request fails", async () => {
    sendRequest.mockRejectedValue(new Error("nope"));
    renderPage();
    fireEvent.change(screen.getByLabelText("Add a friend by username"), {
      target: { value: "ghost" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("User not found")).toBeInTheDocument();
  });

  it("renders incoming requests and responds to one (accept)", async () => {
    respond.mockResolvedValue(undefined);
    const stranger = makeUser("alice");
    setFriends([fs("f1", stranger, ME, "pending")]);
    renderPage();

    expect(screen.getByText("wants to be friends")).toBeInTheDocument();
    expect(screen.getByText("ALICE")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(respond).toHaveBeenCalledWith("f1", "accepted"));
  });

  it("shows an error in PendingCard when respond rejects", async () => {
    respond.mockRejectedValue(new Error("fail"));
    setFriends([fs("f1", makeUser("alice"), ME, "pending")]);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Block" }));
    await waitFor(() => expect(respond).toHaveBeenCalledWith("f1", "blocked"));
    expect(await screen.findByText("Could not update this request")).toBeInTheDocument();
  });

  it("renders an accepted friend with avatar image and online presence", () => {
    const friend = makeUser("alice", { avatarUrl: "http://x/a.png", accentColor: "#fff" });
    setFriends([fs("f2", ME, friend, "accepted")]);
    useOnlineStatus.mockReturnValue({ onlineUsers: new Set(["alice"]) });
    renderPage();

    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText(/1 friend/)).toBeInTheDocument();
    expect(screen.getByText(/1 online/)).toBeInTheDocument();
    expect(document.querySelector(".fr-presence.is-online")).toBeTruthy();
    expect(document.querySelector("img.fr-avatar--img")).toBeTruthy();
  });

  it("opens a DM thread and navigates when Message is clicked", async () => {
    openDMThread.mockResolvedValue({ threadId: "t9" });
    const friend = makeUser("alice");
    setFriends([fs("f2", ME, friend, "accepted")]);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Message" }));
    await waitFor(() => expect(openDMThread).toHaveBeenCalled());
    expect(openDMThread).toHaveBeenCalledWith({ username: "me", password: "pw" }, "alice");
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/messages/t9"));
  });

  it("opens the invite menu and invites the friend to a game", async () => {
    createGame.mockResolvedValue({ gameId: "g1" });
    sendGameInvite.mockResolvedValue(undefined);
    const friend = makeUser("alice");
    setFriends([fs("f2", ME, friend, "accepted")]);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Invite/ }));
    const menu = screen.getByRole("menu");
    fireEvent.click(within(menu).getByText("Nim"));

    await waitFor(() =>
      expect(createGame).toHaveBeenCalledWith({ username: "me", password: "pw" }, "nim"),
    );
    expect(sendGameInvite).toHaveBeenCalledWith({ username: "me", password: "pw" }, "alice", "g1");
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/game/g1"));
  });

  it("closes the invite menu via the backdrop", () => {
    setFriends([fs("f2", ME, makeUser("alice"), "accepted")]);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Invite/ }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.click(document.querySelector(".fr-invite-backdrop")!);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("removes a friend after confirmation", async () => {
    remove.mockResolvedValue(undefined);
    setFriends([fs("f2", ME, makeUser("alice"), "accepted")]);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("f2"));
  });

  it("does not remove a friend when confirmation is cancelled", () => {
    (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(false);
    setFriends([fs("f2", ME, makeUser("alice"), "accepted")]);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(remove).not.toHaveBeenCalled();
  });

  it("renders an outgoing pending request section", () => {
    setFriends([fs("f3", ME, makeUser("carol"), "pending")]);
    renderPage();
    expect(screen.getByText("Pending sent")).toBeInTheDocument();
    expect(screen.getByText("awaiting response…")).toBeInTheDocument();
    expect(screen.getByText("CAROL")).toBeInTheDocument();
  });
});
