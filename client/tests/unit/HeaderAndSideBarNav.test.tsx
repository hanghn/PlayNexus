// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Header from "../../src/components/Header.tsx";
import SideBarNav from "../../src/components/SideBarNav.tsx";

const headerState = vi.hoisted(() => ({
  navigate: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("../../src/hooks/useLoginContext.ts", () => ({
  default: () => ({
    user: {
      username: "bob",
      display: "Bob",
      avatarUrl: "https://example.com/bob.png",
      accentColor: "#0f0",
    },
    reset: headerState.reset,
  }),
}));

vi.mock("../../src/hooks/useAuth.ts", () => ({
  default: () => ({ username: "bob", password: "secret" }),
}));

vi.mock("../../src/hooks/useUnread.ts", () => ({
  default: () => ({ counts: { t1: 12 }, total: 12, markThreadRead: vi.fn() }),
}));

vi.mock("../../src/components/FriendRequestBell.tsx", () => ({
  default: () => <div data-testid="friend-request-bell" />,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => headerState.navigate,
  };
});

afterEach(() => {
  cleanup();
  headerState.navigate.mockReset();
  headerState.reset.mockReset();
});

describe("Header", () => {
  it("opens the account menu and routes to profile or logout", () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText("PlayNexus home"));
    expect(headerState.navigate).toHaveBeenCalledWith("/");

    fireEvent.click(screen.getByLabelText("Account menu for Bob"));
    fireEvent.click(screen.getByRole("menuitem", { name: "View Profile" }));
    expect(headerState.navigate).toHaveBeenCalledWith("/profile/bob");

    fireEvent.click(screen.getByLabelText("Account menu for Bob"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Log Out" }));
    expect(headerState.reset).toHaveBeenCalledTimes(1);
    expect(headerState.navigate).toHaveBeenCalledWith("/login");
  });

  it("renders the avatar image and account metadata", () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    expect(screen.getByAltText("PlayNexus")).toBeTruthy();
    expect(screen.getByText("signed in as")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
    expect(screen.getByTestId("friend-request-bell")).toBeTruthy();
  });
});

describe("SideBarNav", () => {
  it("shows the primary links and unread badge, and toggles collapse", () => {
    const onToggle = vi.fn();

    render(
      <MemoryRouter initialEntries={["/messages"]}>
        <SideBarNav collapsed={false} onToggle={onToggle} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("navigation", { name: "Primary" }).className).toContain("sideBarNav");
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Profile" }).getAttribute("href")).toBe("/profile/bob");
    expect(screen.getByLabelText("12 unread messages").textContent).toBe("9+");

    fireEvent.click(screen.getByRole("button", { name: "Collapse menu" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("collapses to the rail when requested", () => {
    render(
      <MemoryRouter>
        <SideBarNav collapsed={true} onToggle={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "Home" })).toBeNull();
    expect(screen.getByRole("button", { name: "Expand menu" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Primary" }).className).toContain(
      "sideBarNav--collapsed",
    );
  });
});
