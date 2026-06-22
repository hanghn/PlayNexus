// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ---- Mocks ----
const navigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
}));

const dismiss = vi.fn();
const pause = vi.fn();
const resume = vi.fn();
let mockToasts: Array<{
  id: string;
  kind: "dm" | "friend";
  text: string;
  to: string;
}> = [];

vi.mock("../hooks/useSocialToasts.ts", () => ({
  default: () => ({ toasts: mockToasts, dismiss, pause, resume }),
}));

// CSS import is harmless under Vitest, but stub to be safe.
vi.mock("./SocialToasts.css", () => ({}));

import SocialToasts from "./SocialToasts.tsx";

beforeEach(() => {
  vi.clearAllMocks();
  mockToasts = [];
});

afterEach(() => {
  cleanup();
});

describe("SocialToasts", () => {
  it("renders nothing when there are no toasts", () => {
    const { container } = render(<SocialToasts />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a toast for each entry with correct text and icon", () => {
    mockToasts = [
      { id: "dm-1", kind: "dm", text: "Alice sent you a message", to: "/messages/1" },
      { id: "fr-2", kind: "friend", text: "Bob sent you a friend request", to: "/friends" },
    ];
    render(<SocialToasts />);

    expect(screen.getByText("Alice sent you a message")).toBeInTheDocument();
    expect(screen.getByText("Bob sent you a friend request")).toBeInTheDocument();
    // dm => 💬, friend => 👥
    expect(screen.getByText("💬")).toBeInTheDocument();
    expect(screen.getByText("👥")).toBeInTheDocument();
  });

  it("dismisses and navigates when the main button is clicked", () => {
    mockToasts = [{ id: "dm-1", kind: "dm", text: "Alice sent you a message", to: "/messages/1" }];
    render(<SocialToasts />);

    fireEvent.click(screen.getByText("Alice sent you a message"));
    expect(dismiss).toHaveBeenCalledWith("dm-1");
    expect(navigate).toHaveBeenCalledWith("/messages/1");
  });

  it("only dismisses (no navigate) when the X button is clicked", () => {
    mockToasts = [
      { id: "fr-2", kind: "friend", text: "Bob sent you a friend request", to: "/friends" },
    ];
    render(<SocialToasts />);

    fireEvent.click(screen.getByLabelText("Dismiss notification"));
    expect(dismiss).toHaveBeenCalledWith("fr-2");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("pauses on mouse enter / focus and resumes on mouse leave / blur", () => {
    mockToasts = [{ id: "dm-1", kind: "dm", text: "Alice sent you a message", to: "/messages/1" }];
    const { container } = render(<SocialToasts />);
    const stack = container.querySelector(".social-toast-stack") as HTMLElement;
    expect(stack).toBeInTheDocument();

    fireEvent.mouseEnter(stack);
    expect(pause).toHaveBeenCalledTimes(1);

    fireEvent.mouseLeave(stack);
    expect(resume).toHaveBeenCalledTimes(1);

    fireEvent.focus(stack);
    expect(pause).toHaveBeenCalledTimes(2);

    fireEvent.blur(stack);
    expect(resume).toHaveBeenCalledTimes(2);
  });
});
