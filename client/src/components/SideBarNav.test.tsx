// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";

vi.mock("../hooks/useAuth.ts", () => ({
  default: vi.fn(() => ({ username: "alice", password: "" })),
}));

vi.mock("../hooks/useUnread.ts", () => ({
  default: vi.fn(() => ({ total: 0 })),
}));

import SideBarNav from "./SideBarNav.tsx";
import useAuth from "../hooks/useAuth.ts";
import useUnread from "../hooks/useUnread.ts";

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseUnread = vi.mocked(useUnread);

function renderNav(props: { collapsed: boolean; onToggle: () => void }) {
  return render(
    <MemoryRouter>
      <SideBarNav {...props} />
    </MemoryRouter>,
  );
}

describe("SideBarNav", () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
    mockedUseUnread.mockReset();
    mockedUseAuth.mockReturnValue({ username: "alice", password: "" });
    mockedUseUnread.mockReturnValue({ total: 0 } as ReturnType<typeof useUnread>);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nav links when expanded and links to the user's profile", () => {
    renderNav({ collapsed: false, onToggle: vi.fn() });

    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Games" })).toHaveAttribute("href", "/games");
    expect(screen.getByRole("link", { name: "Forum" })).toHaveAttribute("href", "/forum");
    expect(screen.getByRole("link", { name: "Friends" })).toHaveAttribute("href", "/friends");
    expect(screen.getByRole("link", { name: "Messages" })).toHaveAttribute("href", "/messages");
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/profile/alice");
  });

  it("applies the menu_selected class to the active link", () => {
    render(
      <MemoryRouter initialEntries={["/games"]}>
        <SideBarNav collapsed={false} onToggle={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Games" })).toHaveClass("menu_button", "menu_selected");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveClass("menu_selected");
  });

  it("hides nav links and shows expand toggle when collapsed", () => {
    renderNav({ collapsed: true, onToggle: vi.fn() });

    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav).toHaveClass("sideBarNav--collapsed");

    const toggle = screen.getByRole("button", { name: "Expand menu" });
    expect(toggle).toHaveAttribute("title", "Expand menu");
    expect(toggle).toHaveTextContent("»");
  });

  it("shows collapse toggle when expanded", () => {
    renderNav({ collapsed: false, onToggle: vi.fn() });
    const toggle = screen.getByRole("button", { name: "Collapse menu" });
    expect(toggle).toHaveAttribute("title", "Collapse menu");
    expect(toggle).toHaveTextContent("«");
  });

  it("calls onToggle when the toggle button is clicked", () => {
    const onToggle = vi.fn();
    renderNav({ collapsed: false, onToggle });
    fireEvent.click(screen.getByRole("button", { name: "Collapse menu" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("renders an unread badge with the exact count", () => {
    mockedUseUnread.mockReturnValue({ total: 5 } as ReturnType<typeof useUnread>);
    renderNav({ collapsed: false, onToggle: vi.fn() });
    const badge = screen.getByLabelText("5 unread messages");
    expect(badge).toHaveTextContent("5");
  });

  it("caps the unread badge at 9+", () => {
    mockedUseUnread.mockReturnValue({ total: 42 } as ReturnType<typeof useUnread>);
    renderNav({ collapsed: false, onToggle: vi.fn() });
    const badge = screen.getByLabelText("42 unread messages");
    expect(badge).toHaveTextContent("9+");
  });

  it("does not render a badge when there are no unread messages", () => {
    mockedUseUnread.mockReturnValue({ total: 0 } as ReturnType<typeof useUnread>);
    renderNav({ collapsed: false, onToggle: vi.fn() });
    expect(screen.queryByText(/unread messages/)).not.toBeInTheDocument();
    expect(document.querySelector(".nav-badge")).toBeNull();
  });
});
