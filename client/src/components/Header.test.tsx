// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const navigateMock = vi.fn();
const resetMock = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("./FriendRequestBell.tsx", () => ({
  default: () => <div data-testid="friend-request-bell" />,
}));

const loginContextValue: {
  user: {
    username: string;
    display: string;
    avatarUrl?: string;
    accentColor?: string;
  };
  reset: () => void;
} = {
  user: { username: "alice", display: "Alice" },
  reset: resetMock,
};

vi.mock("../hooks/useLoginContext.ts", () => ({
  default: () => loginContextValue,
}));

// Stub static asset imports referenced by the component.
vi.mock("../assets/playnexus-pn-badge.png", () => ({ default: "badge.png" }));
vi.mock("../assets/playnexus-name.png", () => ({ default: "wordmark.png" }));

import Header from "./Header.tsx";

describe("Header", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    resetMock.mockReset();
    loginContextValue.user = { username: "alice", display: "Alice" };
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the brand and account chip, and navigates home on brand click", () => {
    render(<Header />);

    expect(screen.getByTestId("friend-request-bell")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PlayNexus home" })).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "PlayNexus home" }));
    expect(navigateMock).toHaveBeenCalledWith("/");
  });

  it("falls back to an avatar initial when no avatarUrl is set", () => {
    render(<Header />);
    // "Alice" -> "A"
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("renders an avatar image with accent color box-shadow when avatarUrl is set", () => {
    loginContextValue.user = {
      username: "bob",
      display: "Bob",
      avatarUrl: "http://example.com/avatar.png",
      accentColor: "#ff0000",
    };
    const { container } = render(<Header />);
    const img = container.querySelector("img.header-avatar--img") as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toContain("avatar.png");
    expect(img.style.boxShadow).toContain("#ff0000");
  });

  it("toggles the account menu open and closed via the account button", () => {
    render(<Header />);
    const accountBtn = screen.getByRole("button", { name: "Account menu for Alice" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(accountBtn);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(accountBtn).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(accountBtn);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the menu when Escape is pressed on the account button", () => {
    render(<Header />);
    const accountBtn = screen.getByRole("button", { name: "Account menu for Alice" });

    fireEvent.click(accountBtn);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(accountBtn, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the menu when the backdrop is clicked", () => {
    const { container } = render(<Header />);
    fireEvent.click(screen.getByRole("button", { name: "Account menu for Alice" }));

    const backdrop = container.querySelector(".header-menu-backdrop") as HTMLElement;
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("navigates to the profile page and closes the menu on View Profile", () => {
    render(<Header />);
    fireEvent.click(screen.getByRole("button", { name: "Account menu for Alice" }));

    fireEvent.click(screen.getByRole("menuitem", { name: "View Profile" }));
    expect(navigateMock).toHaveBeenCalledWith("/profile/alice");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("resets the session and navigates to login on Log Out", async () => {
    navigateMock.mockResolvedValue(undefined);
    render(<Header />);
    fireEvent.click(screen.getByRole("button", { name: "Account menu for Alice" }));

    fireEvent.click(screen.getByRole("menuitem", { name: "Log Out" }));
    expect(resetMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith("/login");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
