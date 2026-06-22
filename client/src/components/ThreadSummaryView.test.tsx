// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

import ThreadSummaryView from "./ThreadSummaryView.tsx";

type Props = React.ComponentProps<typeof ThreadSummaryView>;

const baseProps: Props = {
  threadId: "thread-123",
  createdBy: { username: "alice", display: "Alice", createdAt: new Date(0) },
  createdAt: new Date(Date.now() - 60_000),
  title: "How to win at GameNite",
  comments: 3,
};

function renderView(overrides: Partial<Props> = {}) {
  return render(
    <MemoryRouter>
      <ThreadSummaryView {...baseProps} {...overrides} />
    </MemoryRouter>,
  );
}

describe("ThreadSummaryView", () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the title, author, and reply count", () => {
    renderView();
    expect(screen.getByText("How to win at GameNite")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("replies")).toBeInTheDocument();
  });

  it("uses singular 'reply' when there is exactly one comment", () => {
    renderView({ comments: 1 });
    expect(screen.getByText("reply")).toBeInTheDocument();
    expect(screen.queryByText("replies")).not.toBeInTheDocument();
  });

  it("uses plural 'replies' when there are zero comments", () => {
    renderView({ comments: 0 });
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("replies")).toBeInTheDocument();
  });

  it("navigates to the thread when the row is clicked", () => {
    renderView();
    fireEvent.click(screen.getByRole("listitem"));
    expect(navigateMock).toHaveBeenCalledWith("/forum/post/thread-123");
  });

  it("navigates when Enter is pressed on the focused row", () => {
    renderView();
    fireEvent.keyDown(screen.getByRole("listitem"), { key: "Enter" });
    expect(navigateMock).toHaveBeenCalledWith("/forum/post/thread-123");
  });

  it("does not navigate for non-Enter key presses", () => {
    renderView();
    fireEvent.keyDown(screen.getByRole("listitem"), { key: "ArrowDown" });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("renders a relative activity time for createdAt", () => {
    renderView();
    // useTimeSince renders something like "a minute ago"; just assert it produced text.
    const activity = document.querySelector(".thread-row-activity");
    expect(activity).not.toBeNull();
    expect(activity?.textContent?.length).toBeGreaterThan(0);
  });
});
