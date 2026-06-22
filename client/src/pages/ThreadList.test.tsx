// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

// Mock the data hook so we control the rendered state deterministically.
const useThreadListMock = vi.fn();
vi.mock("../hooks/useThreadList.ts", () => ({
  default: () => useThreadListMock(),
}));

// Stub the child so we exercise ThreadList's mapping without its deps.
vi.mock("../components/ThreadSummaryView.tsx", () => ({
  default: (props: { title: string }) => <div data-testid="thread-summary">{props.title}</div>,
}));

import ThreadList from "./ThreadList.tsx";

const renderPage = () =>
  render(
    <MemoryRouter>
      <ThreadList />
    </MemoryRouter>,
  );

describe("ThreadList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a message state (e.g. Loading/Error) with zero threads", () => {
    useThreadListMock.mockReturnValue({ message: "Loading..." });
    renderPage();

    expect(screen.getByText("Forum")).toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    // count is 0 -> plural "threads"
    expect(screen.getByText("0 threads")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("renders the empty-array state", () => {
    useThreadListMock.mockReturnValue([]);
    renderPage();

    expect(
      screen.getByText("No posts yet — be the first to start a discussion!"),
    ).toBeInTheDocument();
    expect(screen.getByText("0 threads")).toBeInTheDocument();
  });

  it("renders a list of threads and uses singular label for one thread", () => {
    useThreadListMock.mockReturnValue([
      { threadId: 1, title: "First", createdBy: "a", createdAt: "x", comments: 0 },
    ]);
    renderPage();

    expect(screen.getByText("1 thread")).toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByTestId("thread-summary")).toHaveTextContent("First");
  });

  it("renders multiple threads with plural label", () => {
    useThreadListMock.mockReturnValue([
      { threadId: 1, title: "One", createdBy: "a", createdAt: "x", comments: 0 },
      { threadId: 2, title: "Two", createdBy: "b", createdAt: "y", comments: 3 },
    ]);
    renderPage();

    expect(screen.getByText("2 threads")).toBeInTheDocument();
    expect(screen.getAllByTestId("thread-summary")).toHaveLength(2);
  });

  it("navigates to the new post page when the CTA is clicked", () => {
    useThreadListMock.mockReturnValue({ message: "Loading..." });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /new post/i }));
    expect(navigateMock).toHaveBeenCalledWith("/forum/post/new");
  });
});
