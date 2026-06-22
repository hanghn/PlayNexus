// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// --- Mocks -------------------------------------------------------------------

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const createGameMock = vi.fn();
const sendGameInviteMock = vi.fn();

vi.mock("../services/gameService.ts", () => ({
  createGame: (...args: unknown[]) => createGameMock(...args),
  sendGameInvite: (...args: unknown[]) => sendGameInviteMock(...args),
}));

const authStub = { username: "me", password: "pw" };
vi.mock("../hooks/useAuth.ts", () => ({
  default: () => authStub,
}));

const loginContextStub = { user: { username: "me" } };
vi.mock("../hooks/useLoginContext.ts", () => ({
  default: () => loginContextStub,
}));

let friendshipsStub: unknown[] | null = [];
vi.mock("../hooks/useFriends.ts", () => ({
  default: () => ({ friendships: friendshipsStub }),
}));

// CSS import is harmless under Vite/Vitest but stub to be safe.
vi.mock("./CreateGameMenu.css", () => ({}));

import CreateGameMenu from "./CreateGameMenu.tsx";

function renderMenu() {
  return render(
    <MemoryRouter>
      <CreateGameMenu triggerClassName="trigger" />
    </MemoryRouter>,
  );
}

function openMenu() {
  fireEvent.click(screen.getByLabelText("Create New Game"));
}

const acceptedFriend = {
  status: "accepted",
  from: { username: "me", display: "Me", to: null },
  to: { username: "alice", display: "Alice" },
};

beforeEach(() => {
  vi.clearAllMocks();
  friendshipsStub = [];
  createGameMock.mockResolvedValue({ gameId: "g123" });
  sendGameInviteMock.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
});

// --- Tests -------------------------------------------------------------------

describe("CreateGameMenu", () => {
  it("renders the trigger button collapsed by default", () => {
    renderMenu();
    const trigger = screen.getByLabelText("Create New Game");
    expect(trigger).toHaveClass("trigger");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("toggles the game menu open and lists all game names", () => {
    renderMenu();
    openMenu();
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("Nim")).toBeInTheDocument();
    expect(screen.getByText("Number Guesser")).toBeInTheDocument();
    expect(screen.getByText("Cribbage")).toBeInTheDocument();
    expect(screen.getByLabelText("Create New Game")).toHaveAttribute("aria-expanded", "true");
  });

  it("closes the menu when the backdrop is clicked", () => {
    const { container } = renderMenu();
    openMenu();
    const backdrop = container.querySelector(".create-game-backdrop")!;
    fireEvent.click(backdrop);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens the mode modal for a non-cribbage game (no AI options)", () => {
    renderMenu();
    openMenu();
    fireEvent.click(screen.getByText("Nim"));
    expect(screen.getByText("Start a Nim game")).toBeInTheDocument();
    expect(screen.getByText(/Invite a friend, or open a table/)).toBeInTheDocument();
    expect(screen.queryByText("vs Easy AI")).not.toBeInTheDocument();
    expect(screen.queryByText("vs Hard AI")).not.toBeInTheDocument();
  });

  it("shows AI options and help link for cribbage", () => {
    renderMenu();
    openMenu();
    fireEvent.click(screen.getByText("Cribbage"));
    expect(screen.getByText("vs Easy AI")).toBeInTheDocument();
    expect(screen.getByText("vs Hard AI")).toBeInTheDocument();
    expect(screen.getByText(/How to play/)).toBeInTheDocument();
  });

  it("creates a single-player cribbage game vs Easy AI and navigates", async () => {
    renderMenu();
    openMenu();
    fireEvent.click(screen.getByText("Cribbage"));
    fireEvent.click(screen.getByText("vs Easy AI"));
    await waitFor(() => {
      expect(createGameMock).toHaveBeenCalledWith(authStub, "cribbage", true, "easy");
    });
    expect(navigateMock).toHaveBeenCalledWith("/game/g123");
  });

  it("creates a single-player cribbage game vs Hard AI", async () => {
    renderMenu();
    openMenu();
    fireEvent.click(screen.getByText("Cribbage"));
    fireEvent.click(screen.getByText("vs Hard AI"));
    await waitFor(() => {
      expect(createGameMock).toHaveBeenCalledWith(authStub, "cribbage", true, "hard");
    });
  });

  it("opens a multiplayer table and navigates", async () => {
    renderMenu();
    openMenu();
    fireEvent.click(screen.getByText("Nim"));
    fireEvent.click(screen.getByText("Open table (anyone can join)"));
    await waitFor(() => {
      expect(createGameMock).toHaveBeenCalledWith(authStub, "nim", false, undefined);
    });
    expect(navigateMock).toHaveBeenCalledWith("/game/g123");
  });

  it("shows an error message and stays open when createGame fails", async () => {
    createGameMock.mockRejectedValueOnce(new Error("Only one game at a time"));
    renderMenu();
    openMenu();
    fireEvent.click(screen.getByText("Nim"));
    fireEvent.click(screen.getByText("Open table (anyone can join)"));
    expect(await screen.findByText("Only one game at a time")).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
    // modal still present
    expect(screen.getByText("Start a Nim game")).toBeInTheDocument();
  });

  it("falls back to a generic error for non-Error rejections", async () => {
    createGameMock.mockRejectedValueOnce("boom");
    renderMenu();
    openMenu();
    fireEvent.click(screen.getByText("Nim"));
    fireEvent.click(screen.getByText("Open table (anyone can join)"));
    expect(await screen.findByText("Could not create the game.")).toBeInTheDocument();
  });

  it("shows empty-friends state in the invite view", () => {
    friendshipsStub = [];
    renderMenu();
    openMenu();
    fireEvent.click(screen.getByText("Nim"));
    fireEvent.click(screen.getByText("Invite a friend"));
    expect(screen.getByText(/No friends yet/)).toBeInTheDocument();
  });

  it("lists accepted friends and invites the chosen one", async () => {
    friendshipsStub = [acceptedFriend, { status: "pending", from: {}, to: {} }];
    renderMenu();
    openMenu();
    fireEvent.click(screen.getByText("Nim"));
    fireEvent.click(screen.getByText("Invite a friend"));
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("@alice")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Alice"));
    await waitFor(() => {
      expect(createGameMock).toHaveBeenCalledWith(authStub, "nim", false);
    });
    expect(sendGameInviteMock).toHaveBeenCalledWith(authStub, "alice", "g123");
    expect(navigateMock).toHaveBeenCalledWith("/game/g123");
  });

  it("shows an error when inviting a friend fails", async () => {
    friendshipsStub = [acceptedFriend];
    sendGameInviteMock.mockRejectedValueOnce(new Error("Invite failed"));
    renderMenu();
    openMenu();
    fireEvent.click(screen.getByText("Nim"));
    fireEvent.click(screen.getByText("Invite a friend"));
    fireEvent.click(screen.getByText("Alice"));
    expect(await screen.findByText("Invite failed")).toBeInTheDocument();
  });

  it("navigates back from the friends view to the mode view", () => {
    renderMenu();
    openMenu();
    fireEvent.click(screen.getByText("Nim"));
    fireEvent.click(screen.getByText("Invite a friend"));
    expect(screen.getByText("Invite a friend")).toBeInTheDocument();
    fireEvent.click(screen.getByText("← Back"));
    expect(screen.getByText("Start a Nim game")).toBeInTheDocument();
  });

  it("closes the modal via Cancel and via overlay click", () => {
    const { container } = renderMenu();
    openMenu();
    fireEvent.click(screen.getByText("Nim"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Start a Nim game")).not.toBeInTheDocument();

    // reopen and close via overlay
    openMenu();
    fireEvent.click(screen.getByText("Nim"));
    const overlay = container.querySelector(".create-game-overlay")!;
    fireEvent.click(overlay);
    expect(screen.queryByText("Start a Nim game")).not.toBeInTheDocument();
  });

  it("does not close the modal when clicking inside it", () => {
    const { container } = renderMenu();
    openMenu();
    fireEvent.click(screen.getByText("Nim"));
    const modal = container.querySelector(".create-game-modal")!;
    fireEvent.click(modal);
    expect(screen.getByText("Start a Nim game")).toBeInTheDocument();
  });

  it("tolerates null friendships without crashing", () => {
    friendshipsStub = null;
    renderMenu();
    openMenu();
    fireEvent.click(screen.getByText("Nim"));
    fireEvent.click(screen.getByText("Invite a friend"));
    expect(screen.getByText(/No friends yet/)).toBeInTheDocument();
  });
});
