// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { FriendshipInfo } from "@gamenite/shared";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  friendships: [] as FriendshipInfo[],
  createGame: vi.fn(),
  sendGameInvite: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock("../../src/hooks/useAuth.ts", () => ({
  default: () => ({ username: "me", password: "pw" }),
}));

vi.mock("../../src/hooks/useLoginContext.ts", () => ({
  default: () => ({ user: { username: "me", display: "Me" } }),
}));

vi.mock("../../src/hooks/useFriends.ts", () => ({
  default: () => ({ friendships: mocks.friendships }),
}));

vi.mock("../../src/services/gameService.ts", () => ({
  createGame: (...args: unknown[]): unknown => mocks.createGame(...args),
  sendGameInvite: (...args: unknown[]): unknown => mocks.sendGameInvite(...args),
}));

import CreateGameMenu from "../../src/components/CreateGameMenu.tsx";

const friendship = (username: string, display: string): FriendshipInfo =>
  ({
    friendshipId: `f-${username}`,
    status: "accepted",
    from: { username: "me", display: "Me", createdAt: new Date() },
    to: { username, display, createdAt: new Date() },
  }) as FriendshipInfo;

// A friendship where the *other* user initiated it (I am the `to`), exercising
// the other side of the "resolve to the other user" mapping.
const friendshipFrom = (username: string, display: string): FriendshipInfo =>
  ({
    friendshipId: `f-${username}`,
    status: "accepted",
    from: { username, display, createdAt: new Date() },
    to: { username: "me", display: "Me", createdAt: new Date() },
  }) as FriendshipInfo;

const renderMenu = () =>
  render(
    <MemoryRouter>
      <CreateGameMenu triggerClassName="trigger" />
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  mocks.friendships = [];
  vi.clearAllMocks();
});

describe("CreateGameMenu", () => {
  it("toggles the game menu open and closed", () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: "Create New Game" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Cribbage" })).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the menu when the backdrop is clicked", () => {
    const { container } = renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Create New Game" }));
    fireEvent.click(container.querySelector(".create-game-backdrop")!);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("shows AI options for cribbage and starts a single-player game", async () => {
    mocks.createGame.mockResolvedValue({ gameId: "g99" });
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Create New Game" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Cribbage" }));

    expect(screen.getByText("Start a Cribbage game")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "vs Hard AI" }));

    await waitFor(() =>
      expect(mocks.createGame).toHaveBeenCalledWith(
        { username: "me", password: "pw" },
        "cribbage",
        true,
        "hard",
      ),
    );
    expect(mocks.navigate).toHaveBeenCalledWith("/game/g99");
  });

  it("opens a public table for a non-cribbage game", async () => {
    mocks.createGame.mockResolvedValue({ gameId: "g5" });
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Create New Game" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Nim" }));

    // No AI buttons for non-cribbage games.
    expect(screen.queryByRole("button", { name: "vs Easy AI" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open table (anyone can join)" }));

    await waitFor(() =>
      expect(mocks.createGame).toHaveBeenCalledWith(
        { username: "me", password: "pw" },
        "nim",
        false,
        undefined,
      ),
    );
    expect(mocks.navigate).toHaveBeenCalledWith("/game/g5");
  });

  it("surfaces an error message when game creation fails", async () => {
    mocks.createGame.mockRejectedValue(new Error("One game at a time"));
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Create New Game" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Nim" }));
    fireEvent.click(screen.getByRole("button", { name: "Open table (anyone can join)" }));

    expect(await screen.findByText("One game at a time")).toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("uses a generic message when the thrown value is not an Error", async () => {
    mocks.createGame.mockRejectedValue("boom");
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Create New Game" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Nim" }));
    fireEvent.click(screen.getByRole("button", { name: "Open table (anyone can join)" }));

    expect(await screen.findByText("Could not create the game.")).toBeInTheDocument();
  });

  it("shows an empty-friends notice in the invite view and can go back", () => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Create New Game" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Nim" }));
    fireEvent.click(screen.getByRole("button", { name: "Invite a friend" }));

    expect(screen.getByText("Invite a friend")).toBeInTheDocument();
    expect(screen.getByText(/No friends yet/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "← Back" }));
    expect(screen.getByText("Start a Nim game")).toBeInTheDocument();
  });

  it("invites a chosen friend to a new game", async () => {
    mocks.friendships = [friendship("alice", "Alice")];
    mocks.createGame.mockResolvedValue({ gameId: "g7" });
    mocks.sendGameInvite.mockResolvedValue(undefined);
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Create New Game" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Nim" }));
    fireEvent.click(screen.getByRole("button", { name: "Invite a friend" }));

    expect(screen.getByText("@alice")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Alice/ }));

    await waitFor(() =>
      expect(mocks.sendGameInvite).toHaveBeenCalledWith(
        { username: "me", password: "pw" },
        "alice",
        "g7",
      ),
    );
    expect(mocks.navigate).toHaveBeenCalledWith("/game/g7");
  });

  it("reports an error when inviting a friend fails", async () => {
    mocks.friendships = [friendship("alice", "Alice")];
    mocks.createGame.mockRejectedValue(new Error("nope"));
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Create New Game" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Nim" }));
    fireEvent.click(screen.getByRole("button", { name: "Invite a friend" }));
    fireEvent.click(screen.getByRole("button", { name: /Alice/ }));

    expect(await screen.findByText("nope")).toBeInTheDocument();
  });

  it("uses a generic message when an invite throws a non-Error value", async () => {
    mocks.friendships = [friendship("alice", "Alice")];
    mocks.createGame.mockRejectedValue("kaboom");
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Create New Game" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Nim" }));
    fireEvent.click(screen.getByRole("button", { name: "Invite a friend" }));
    fireEvent.click(screen.getByRole("button", { name: /Alice/ }));

    expect(await screen.findByText("Could not create the game.")).toBeInTheDocument();
  });

  it("resolves a friendship to the other user when they initiated it", () => {
    mocks.friendships = [friendshipFrom("zoe", "Zoe")];
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Create New Game" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Nim" }));
    fireEvent.click(screen.getByRole("button", { name: "Invite a friend" }));

    expect(screen.getByText("@zoe")).toBeInTheDocument();
    expect(screen.getByText("Zoe")).toBeInTheDocument();
  });

  it("treats a missing friendships list as no friends", () => {
    mocks.friendships = undefined as unknown as FriendshipInfo[];
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Create New Game" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Nim" }));
    fireEvent.click(screen.getByRole("button", { name: "Invite a friend" }));

    expect(screen.getByText(/No friends yet/)).toBeInTheDocument();
  });

  it("starts a single-player Easy AI cribbage game", async () => {
    mocks.createGame.mockResolvedValue({ gameId: "g42" });
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Create New Game" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Cribbage" }));
    fireEvent.click(screen.getByRole("button", { name: "vs Easy AI" }));

    await waitFor(() =>
      expect(mocks.createGame).toHaveBeenCalledWith(
        { username: "me", password: "pw" },
        "cribbage",
        true,
        "easy",
      ),
    );
  });

  it("cancels out of the mode modal via the overlay, inner click, and Cancel button", () => {
    const { container } = renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Create New Game" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Nim" }));

    // Clicking inside the modal does not close it (stopPropagation).
    fireEvent.click(screen.getByText("Start a Nim game"));
    expect(screen.getByText("Start a Nim game")).toBeInTheDocument();

    // Clicking the overlay (outside the modal) closes it when not busy.
    fireEvent.click(container.querySelector(".create-game-overlay")!);
    expect(screen.queryByText("Start a Nim game")).not.toBeInTheDocument();

    // Re-open and close via the Cancel button.
    fireEvent.click(screen.getByRole("button", { name: "Create New Game" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Nim" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Start a Nim game")).not.toBeInTheDocument();
  });
});
