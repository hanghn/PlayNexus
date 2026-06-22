// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import type { GameInfo, SafeUserInfo } from "@gamenite/shared";

// ---- mocked hook/service spies ----
const navigate = vi.fn();
const useParams = vi.fn();
const useLoginContext = vi.fn();
const useAuth = vi.fn();
const useEditProfileForm = vi.fn();
const useFriends = vi.fn();
const useOnlineStatus = vi.fn();

const getUserById = vi.fn();
const gameList = vi.fn();
const openDMThread = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
    useParams: () => useParams(),
  };
});

vi.mock("../hooks/useLoginContext.ts", () => ({ default: () => useLoginContext() }));
vi.mock("../hooks/useAuth.ts", () => ({ default: () => useAuth() }));
vi.mock("../hooks/useEditProfileForm.ts", () => ({ default: () => useEditProfileForm() }));
vi.mock("../hooks/useFriends.ts", () => ({ default: () => useFriends() }));
vi.mock("../hooks/useOnlinestatus.ts", () => ({ default: () => useOnlineStatus() }));
// useTimeSince returns a formatter function; keep it real-ish but deterministic.
vi.mock("../hooks/useTimeSince.ts", () => ({ default: () => () => "a while ago" }));

vi.mock("../services/userService.ts", () => ({
  getUserById: (...a: unknown[]) => getUserById(...a),
}));
vi.mock("../services/gameService.ts", () => ({
  gameList: (...a: unknown[]) => gameList(...a),
}));
vi.mock("../services/dmService.ts", () => ({
  openDMThread: (...a: unknown[]) => openDMThread(...a),
}));
vi.mock("../services/api.ts", () => ({
  apiErrorMessage: (_err: unknown, fallback: string) => fallback,
}));

// Child components rendered by OwnProfile — stub them so we focus on Profile.tsx.
vi.mock("../components/SecuritySettings.tsx", () => ({
  default: () => <div data-testid="security-settings" />,
}));
vi.mock("../components/AccessibilitySettings.tsx", () => ({
  default: () => <div data-testid="accessibility-settings" />,
}));
vi.mock("./Profile.css", () => ({}));

import Profile from "./Profile.tsx";

function makeUser(username: string, extra: Partial<SafeUserInfo> = {}): SafeUserInfo {
  return {
    username,
    display: username.toUpperCase(),
    createdAt: "2024-01-01T00:00:00.000Z",
    ...extra,
  } as unknown as SafeUserInfo;
}

const ME = makeUser("me");

function makeGame(id: string, type: string, status: string, players: string[]): GameInfo {
  return {
    gameId: id,
    type,
    status,
    createdAt: "2024-01-01T00:00:00.000Z",
    players: players.map((p) => ({ username: p })),
  } as unknown as GameInfo;
}

function defaultForm() {
  return {
    display: "Me Display",
    setDisplay: vi.fn(),
    bio: "hello bio",
    setBio: vi.fn(),
    bioStatus: null as string | null,
    handleSaveBio: vi.fn((e: { preventDefault: () => void }) => e.preventDefault()),
    accent: "",
    accentChoice: "",
    setAccentChoice: vi.fn(),
    accentStatus: null as string | null,
    handleSaveAccent: vi.fn((e: { preventDefault: () => void }) => e.preventDefault()),
    avatarUrl: "",
    avatarStatus: null as string | null,
    savingAvatar: false,
    handleSaveAvatar: vi.fn(),
    handleClearAvatar: vi.fn(),
    password: "",
    setPassword: vi.fn(),
    confirm: "",
    setConfirm: vi.fn(),
    err: null as string | null,
    handleSubmit: vi.fn((e: { preventDefault: () => void }) => e.preventDefault()),
  };
}

function renderProfile() {
  return render(
    <MemoryRouter>
      <Profile />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useParams.mockReturnValue({});
  useLoginContext.mockReturnValue({ user: ME, socket: { connected: true } });
  useAuth.mockReturnValue({ username: "me", password: "pw" });
  useOnlineStatus.mockReturnValue({ onlineUsers: new Set<string>() });
  useFriends.mockReturnValue({ friendships: [] });
  useEditProfileForm.mockReturnValue(defaultForm());
  gameList.mockResolvedValue([]);
  getUserById.mockResolvedValue(makeUser("alice"));
  openDMThread.mockResolvedValue({ threadId: "t1" });
});

afterEach(() => {
  cleanup();
});

describe("Profile dispatcher", () => {
  it("renders OwnProfile when there is no :username param", async () => {
    renderProfile();
    expect(screen.getByText("@me")).toBeInTheDocument();
    expect(screen.getByText("Profile details")).toBeInTheDocument();
    await waitFor(() => expect(gameList).toHaveBeenCalled());
  });

  it("renders OwnProfile when :username matches the logged-in user", async () => {
    useParams.mockReturnValue({ username: "me" });
    renderProfile();
    expect(screen.getByText("Profile details")).toBeInTheDocument();
    await waitFor(() => expect(gameList).toHaveBeenCalled());
  });

  it("renders PublicProfile for another user", async () => {
    useParams.mockReturnValue({ username: "alice" });
    renderProfile();
    expect(await screen.findByText("@alice")).toBeInTheDocument();
    expect(getUserById).toHaveBeenCalledWith("alice");
  });
});

describe("OwnProfile", () => {
  it("shows online presence and connected stat when socket is connected", async () => {
    renderProfile();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(document.querySelector(".pf-presence.is-online")).toBeTruthy();
    await waitFor(() => expect(gameList).toHaveBeenCalled());
  });

  it("shows offline state when socket is not connected", async () => {
    useLoginContext.mockReturnValue({ user: ME, socket: { connected: false } });
    renderProfile();
    expect(screen.getByText("Offline")).toBeInTheDocument();
    await waitFor(() => expect(gameList).toHaveBeenCalled());
  });

  it("counts friends and online friends", async () => {
    const friendships = [
      {
        friendshipId: "f1",
        status: "accepted",
        from: ME,
        to: makeUser("alice"),
      },
      {
        friendshipId: "f2",
        status: "accepted",
        from: makeUser("bob"),
        to: ME,
      },
      {
        friendshipId: "f3",
        status: "pending",
        from: ME,
        to: makeUser("carol"),
      },
    ];
    useFriends.mockReturnValue({ friendships });
    useOnlineStatus.mockReturnValue({ onlineUsers: new Set(["alice"]) });
    renderProfile();

    // 2 accepted friends.
    expect(screen.getByText("2")).toBeInTheDocument();
    // "Friends" appears both as a stat label and the card heading.
    expect(screen.getByRole("heading", { name: "Friends" })).toBeInTheDocument();
    await waitFor(() => expect(gameList).toHaveBeenCalled());
  });

  it("renders singular Friend label for exactly one friend", async () => {
    useFriends.mockReturnValue({
      friendships: [{ friendshipId: "f1", status: "accepted", from: ME, to: makeUser("alice") }],
    });
    renderProfile();
    expect(screen.getByText("Friend")).toBeInTheDocument();
    await waitFor(() => expect(gameList).toHaveBeenCalled());
  });

  it("toggles the friends list and renders friend links", async () => {
    useFriends.mockReturnValue({
      friendships: [{ friendshipId: "f1", status: "accepted", from: ME, to: makeUser("alice") }],
    });
    useOnlineStatus.mockReturnValue({ onlineUsers: new Set(["alice"]) });
    renderProfile();

    const toggle = screen.getByRole("button", { name: /1 friend/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(document.querySelector(".pf-dot.is-online")).toBeTruthy();
  });

  it("shows 'No friends yet' when expanding an empty friends list", () => {
    renderProfile();
    fireEvent.click(screen.getByRole("button", { name: /0 friends/ }));
    expect(screen.getByText("No friends yet.")).toBeInTheDocument();
  });

  it("saving bio and accent calls the form handlers", () => {
    const form = defaultForm();
    useEditProfileForm.mockReturnValue(form);
    renderProfile();

    // There are multiple Save buttons; click the bio Save (first) and accent Save.
    const saves = screen.getAllByRole("button", { name: "Save" });
    fireEvent.click(saves[0]);
    fireEvent.click(saves[1]);
    expect(form.handleSaveBio).toHaveBeenCalled();
    expect(form.handleSaveAccent).toHaveBeenCalled();
  });

  it("editing the display name and bio calls setters", () => {
    const form = defaultForm();
    useEditProfileForm.mockReturnValue(form);
    renderProfile();

    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "New Name" } });
    expect(form.setDisplay).toHaveBeenCalledWith("New Name");

    fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "new bio" } });
    expect(form.setBio).toHaveBeenCalledWith("new bio");
  });

  it("Reset display button resets to the user's display name", () => {
    const form = defaultForm();
    useEditProfileForm.mockReturnValue(form);
    renderProfile();
    const resets = screen.getAllByRole("button", { name: "Reset" });
    fireEvent.click(resets[0]);
    expect(form.setDisplay).toHaveBeenCalledWith(ME.display);
  });

  it("hex input strips invalid characters and prefixes #", () => {
    const form = defaultForm();
    useEditProfileForm.mockReturnValue(form);
    renderProfile();
    fireEvent.change(screen.getByLabelText("Banner color hex code"), {
      target: { value: "zz12ABccdd" },
    });
    expect(form.setAccentChoice).toHaveBeenCalledWith("#12ABcc");
  });

  it("hex input emits empty string when cleared", () => {
    const form = defaultForm();
    useEditProfileForm.mockReturnValue(form);
    renderProfile();
    // only-invalid input strips down to empty, emitting "".
    fireEvent.change(screen.getByLabelText("Banner color hex code"), { target: { value: "ghij" } });
    expect(form.setAccentChoice).toHaveBeenCalledWith("");
  });

  it("color picker updates the accent choice", () => {
    const form = defaultForm();
    useEditProfileForm.mockReturnValue(form);
    renderProfile();
    fireEvent.change(screen.getByLabelText("Pick a banner color"), {
      target: { value: "#abcdef" },
    });
    expect(form.setAccentChoice).toHaveBeenCalledWith("#abcdef");
  });

  it("clicking a swatch selects that accent color", () => {
    const form = { ...defaultForm(), accentChoice: "#fecaca" };
    useEditProfileForm.mockReturnValue(form);
    renderProfile();
    const swatch = screen.getByRole("button", { name: "Use banner color #fed7aa" });
    fireEvent.click(swatch);
    expect(form.setAccentChoice).toHaveBeenCalledWith("#fed7aa");
    // the currently-chosen swatch is marked selected
    expect(screen.getByRole("button", { name: "Use banner color #fecaca" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("Clear accent button resets the accent choice to empty", () => {
    const form = defaultForm();
    useEditProfileForm.mockReturnValue(form);
    renderProfile();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(form.setAccentChoice).toHaveBeenCalledWith("");
  });

  it("renders status messages when present", async () => {
    useEditProfileForm.mockReturnValue({
      ...defaultForm(),
      bioStatus: "Bio saved",
      accentStatus: "Color saved",
      avatarStatus: "Avatar updated",
      err: "Something broke",
    });
    renderProfile();
    expect(screen.getByText("Bio saved")).toBeInTheDocument();
    expect(screen.getByText("Color saved")).toBeInTheDocument();
    expect(screen.getByText("Avatar updated")).toBeInTheDocument();
    expect(screen.getByText("Something broke")).toBeInTheDocument();
    await waitFor(() => expect(gameList).toHaveBeenCalled());
  });

  it("renders the avatar image and Remove button when avatarUrl is set", () => {
    const form = { ...defaultForm(), avatarUrl: "http://x/a.png" };
    useEditProfileForm.mockReturnValue(form);
    renderProfile();
    expect(document.querySelector("img.pf-hero-img")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(form.handleClearAvatar).toHaveBeenCalled();
  });

  it("shows the uploading state and disables avatar controls while saving", () => {
    useEditProfileForm.mockReturnValue({ ...defaultForm(), savingAvatar: true });
    renderProfile();
    expect(screen.getByText("Uploading…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change avatar" })).toBeDisabled();
  });

  it("picking an avatar file calls handleSaveAvatar", () => {
    const form = defaultForm();
    useEditProfileForm.mockReturnValue(form);
    renderProfile();
    const fileInput = screen.getByLabelText("Choose avatar image");
    const file = new File(["x"], "a.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(form.handleSaveAvatar).toHaveBeenCalledWith(file);
  });

  it("picking no file does not call handleSaveAvatar", () => {
    const form = defaultForm();
    useEditProfileForm.mockReturnValue(form);
    renderProfile();
    const fileInput = screen.getByLabelText("Choose avatar image");
    fireEvent.change(fileInput, { target: { files: [] } });
    expect(form.handleSaveAvatar).not.toHaveBeenCalled();
  });

  it("clicking the avatar button opens the hidden file input", () => {
    renderProfile();
    const fileInput = screen.getByLabelText("Choose avatar image");
    const clickSpy = vi.spyOn(fileInput as HTMLInputElement, "click");
    fireEvent.click(screen.getByRole("button", { name: "Change avatar" }));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("toggles password visibility and edits password fields", () => {
    const form = defaultForm();
    useEditProfileForm.mockReturnValue(form);
    renderProfile();

    const pw = screen.getByLabelText<HTMLInputElement>("New password");
    expect(pw.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Toggle show password" }));
    // the source uses type="input", which jsdom normalizes to "text".
    expect(screen.getByLabelText<HTMLInputElement>("New password").type).toBe("text");

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "secret" } });
    expect(form.setPassword).toHaveBeenCalledWith("secret");
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "secret" },
    });
    expect(form.setConfirm).toHaveBeenCalledWith("secret");
  });

  it("Reset password button clears both password fields", () => {
    const form = defaultForm();
    useEditProfileForm.mockReturnValue(form);
    renderProfile();
    // The password section's Reset is the last Reset button.
    const resets = screen.getAllByRole("button", { name: "Reset" });
    fireEvent.click(resets[resets.length - 1]);
    expect(form.setPassword).toHaveBeenCalledWith("");
    expect(form.setConfirm).toHaveBeenCalledWith("");
  });

  it("submitting the form calls handleSubmit", () => {
    const form = defaultForm();
    useEditProfileForm.mockReturnValue(form);
    renderProfile();
    fireEvent.click(screen.getByRole("button", { name: "Save & sign out" }));
    expect(form.handleSubmit).toHaveBeenCalled();
  });

  it("renders recent games for the current user", async () => {
    gameList.mockResolvedValue([makeGame("g1", "nim", "active", ["me"])]);
    renderProfile();
    expect(await screen.findByText("Nim")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("renders avatar initial when there is no avatar image", async () => {
    renderProfile();
    // ME.display = "ME", initial "M"
    expect(screen.getByText("M")).toBeInTheDocument();
    await waitFor(() => expect(gameList).toHaveBeenCalled());
  });
});

describe("PublicProfile", () => {
  beforeEach(() => {
    useParams.mockReturnValue({ username: "alice" });
  });

  it("shows a loading state before the profile resolves", () => {
    let resolve!: (u: SafeUserInfo) => void;
    getUserById.mockReturnValue(new Promise((r) => (resolve = r)));
    renderProfile();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    resolve(makeUser("alice"));
  });

  it("shows an error state when the user is not found", async () => {
    getUserById.mockRejectedValue(new Error("boom"));
    renderProfile();
    expect(await screen.findByText("User not found")).toBeInTheDocument();
  });

  it("renders the public profile with bio and online presence", async () => {
    getUserById.mockResolvedValue(
      makeUser("alice", { bio: "I like games", accentColor: "#123456" }),
    );
    useOnlineStatus.mockReturnValue({ onlineUsers: new Set(["alice"]) });
    renderProfile();
    expect(await screen.findByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("I like games")).toBeInTheDocument();
    expect(document.querySelector(".pf-presence.is-online")).toBeTruthy();
  });

  it("renders the placeholder bio when the user has no bio", async () => {
    getUserById.mockResolvedValue(makeUser("alice"));
    renderProfile();
    expect(await screen.findByText("This user hasn't written a bio yet.")).toBeInTheDocument();
  });

  it("renders an avatar image when avatarUrl is set", async () => {
    getUserById.mockResolvedValue(makeUser("alice", { avatarUrl: "http://x/a.png" }));
    renderProfile();
    await screen.findByText("@alice");
    expect(document.querySelector("img.pf-hero-img")).toBeTruthy();
  });

  it("opens a DM thread and navigates when Message is clicked", async () => {
    openDMThread.mockResolvedValue({ threadId: "t9" });
    renderProfile();
    await screen.findByText("@alice");
    fireEvent.click(screen.getByRole("button", { name: "Message" }));
    await waitFor(() =>
      expect(openDMThread).toHaveBeenCalledWith({ username: "me", password: "pw" }, "alice"),
    );
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/messages/t9"));
  });

  it("ignores errors from the Message button (best-effort)", async () => {
    openDMThread.mockRejectedValue(new Error("nope"));
    renderProfile();
    await screen.findByText("@alice");
    fireEvent.click(screen.getByRole("button", { name: "Message" }));
    await waitFor(() => expect(openDMThread).toHaveBeenCalled());
    expect(navigate).not.toHaveBeenCalled();
  });

  it("filters, sorts, and limits recent games to three", async () => {
    getUserById.mockResolvedValue(makeUser("alice"));
    gameList.mockResolvedValue([
      makeGame("g1", "nim", "over", ["alice"]),
      makeGame("g2", "guess", "active", ["bob"]), // filtered out
      { ...makeGame("g3", "cribbage", "active", ["alice"]), createdAt: "2025-01-01T00:00:00.000Z" },
      { ...makeGame("g4", "nim", "active", ["alice"]), createdAt: "2023-01-01T00:00:00.000Z" },
      { ...makeGame("g5", "guess", "active", ["alice"]), createdAt: "2022-01-01T00:00:00.000Z" },
    ]);
    renderProfile();
    await screen.findByText("@alice");
    await waitFor(() => expect(screen.getByText("Cribbage")).toBeInTheDocument());
    expect(screen.getAllByText(/Nim|Cribbage|Number Guesser/).length).toBe(3);
  });

  it("shows the empty recent-games state when there are none", async () => {
    getUserById.mockResolvedValue(makeUser("alice"));
    gameList.mockResolvedValue([]);
    renderProfile();
    await screen.findByText("@alice");
    expect(screen.getByText("No games yet.")).toBeInTheDocument();
  });
});
