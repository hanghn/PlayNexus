// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { forwardRef, useImperativeHandle } from "react";
import * as matchers from "@testing-library/jest-dom/matchers";
import type { ThreadInfo } from "@gamenite/shared";

expect.extend(matchers);

/* ---- Mocked module state (declared before vi.mock factories run) ---- */
const mockUseThreadInfo = vi.fn();
const mockDeleteComment = vi.fn();
const mockSetThread = vi.fn();
const mockStartReply = vi.fn();
const mockNewForumComment = vi.fn();

vi.mock("react-router-dom", () => ({
  // ThreadPage reads the route param; UserChip renders a <Link>.
  useParams: () => ({ threadId: "thread-1" }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("../hooks/useThreadInfo.ts", () => ({
  default: (...args: unknown[]) => mockUseThreadInfo(...args),
}));

vi.mock("../hooks/useAuth.ts", () => ({
  default: () => ({ username: "alice", password: "secret" }),
}));

vi.mock("../hooks/useLoginContext.ts", () => ({
  default: () => ({
    user: { username: "alice", display: "Alice" },
    pass: "secret",
    socket: {},
    reset: vi.fn(),
    onlineUsers: new Set<string>(),
  }),
}));

vi.mock("../hooks/useTimeSince.ts", () => ({
  // Deterministic formatter so we can assert on the byline text.
  default: () => () => "2 hours ago",
}));

vi.mock("../services/threadService.ts", () => ({
  deleteComment: (...args: unknown[]) => mockDeleteComment(...args),
}));

vi.mock("../components/NewForumComment.tsx", () => ({
  // forwardRef so ThreadPage's composerRef receives the imperative handle.
  default: forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
    mockNewForumComment(props);
    useImperativeHandle(ref, () => ({ startReply: mockStartReply }));
    return <div data-testid="new-forum-comment" />;
  }),
}));

import ThreadPage from "./ThreadPage.tsx";

function user(username: string, display = username) {
  return { username, display, createdAt: new Date("2020-01-01T00:00:00Z") };
}

function makeThread(overrides: Partial<ThreadInfo> = {}): ThreadInfo {
  return {
    threadId: "thread-1",
    title: "A Great Post",
    text: "Body of the post",
    createdAt: new Date("2020-01-01T00:00:00Z"),
    createdBy: user("alice", "Alice"),
    comments: [],
    ...overrides,
  };
}

describe("ThreadPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => cleanup());

  it("renders the loading/error message when threadInfo carries a message", () => {
    mockUseThreadInfo.mockReturnValue({
      threadInfo: { message: "Loading..." },
      setThread: mockSetThread,
    });
    render(<ThreadPage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    // No reply form rendered in the message branch.
    expect(screen.queryByTestId("new-forum-comment")).not.toBeInTheDocument();
  });

  it("renders the hero (title, body, byline) and the reply form for a thread with no comments", () => {
    mockUseThreadInfo.mockReturnValue({
      threadInfo: makeThread(),
      setThread: mockSetThread,
    });
    render(<ThreadPage />);

    expect(screen.getByRole("heading", { name: "A Great Post" })).toBeInTheDocument();
    expect(screen.getByText("Body of the post")).toBeInTheDocument();
    expect(screen.getByText(/Posted by/)).toBeInTheDocument();
    // The relative time is interleaved with other byline text nodes.
    expect(screen.getByText(/Posted by/).textContent).toContain("2 hours ago");
    expect(screen.getByTestId("new-forum-comment")).toBeInTheDocument();
    // firstPost should be true since there are no comments.
    const props = mockNewForumComment.mock.calls[0][0];
    expect(props.firstPost).toBe(true);
    expect(props.threadId).toBe("thread-1");
    // No comment list when there are no comments.
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("passes the post text to startReply when the hero Reply button is clicked", () => {
    mockUseThreadInfo.mockReturnValue({
      threadInfo: makeThread(),
      setThread: mockSetThread,
    });
    render(<ThreadPage />);
    fireEvent.click(screen.getByRole("button", { name: /Reply/ }));
    expect(mockStartReply).toHaveBeenCalledWith({ sender: "Alice", text: "Body of the post" });
  });

  it("renders comments, an OP badge, a parsed reply quote, and the edited marker", () => {
    const thread = makeThread({
      comments: [
        {
          commentId: "c1",
          // Encoded reply quote: "↪ {sender}: {snippet}\n{body}"
          text: "↪ Alice: the original snippet\nNice work!",
          createdBy: user("bob", "Bob"),
          createdAt: new Date("2020-01-02T00:00:00Z"),
          editedAt: new Date("2020-01-03T00:00:00Z"),
        },
        {
          commentId: "c2",
          text: "I am the OP replying",
          createdBy: user("alice", "Alice"),
          createdAt: new Date("2020-01-02T00:00:00Z"),
        },
      ],
    });
    mockUseThreadInfo.mockReturnValue({ threadInfo: thread, setThread: mockSetThread });
    render(<ThreadPage />);

    // Comment list present with two items.
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    // The quoted block from the encoded reply.
    expect(screen.getByText("the original snippet")).toBeInTheDocument(); // quote snippet
    expect(screen.getByText("Nice work!")).toBeInTheDocument(); // parsed body

    // OP badge: alice is the thread creator, bob is not — exactly one badge.
    expect(screen.getAllByText("OP")).toHaveLength(1);

    // Edited marker for the first comment (interleaved text node).
    expect(document.body.textContent).toContain("edited 2 hours ago");

    // firstPost is false now that comments exist.
    const props = mockNewForumComment.mock.calls[0][0];
    expect(props.firstPost).toBe(false);
  });

  it("shows a Delete button only on the current user's own comments", () => {
    const thread = makeThread({
      comments: [
        {
          commentId: "c1",
          text: "from bob",
          createdBy: user("bob", "Bob"),
          createdAt: new Date("2020-01-02T00:00:00Z"),
        },
        {
          commentId: "c2",
          text: "from alice",
          createdBy: user("alice", "Alice"),
          createdAt: new Date("2020-01-02T00:00:00Z"),
        },
      ],
    });
    mockUseThreadInfo.mockReturnValue({ threadInfo: thread, setThread: mockSetThread });
    render(<ThreadPage />);
    // Only alice (the logged-in user) gets a Delete button.
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(1);
  });

  it("deletes a comment when confirmed and updates the thread", async () => {
    const updated = makeThread({ title: "After delete" });
    mockDeleteComment.mockResolvedValue(updated);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    const thread = makeThread({
      comments: [
        {
          commentId: "c2",
          text: "from alice",
          createdBy: user("alice", "Alice"),
          createdAt: new Date("2020-01-02T00:00:00Z"),
        },
      ],
    });
    mockUseThreadInfo.mockReturnValue({ threadInfo: thread, setThread: mockSetThread });
    render(<ThreadPage />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(mockDeleteComment).toHaveBeenCalledTimes(1));
    expect(mockDeleteComment).toHaveBeenCalledWith(
      { username: "alice", password: "secret" },
      "thread-1",
      "c2",
    );
    await waitFor(() => expect(mockSetThread).toHaveBeenCalledWith(updated));
    confirmSpy.mockRestore();
  });

  it("does not delete when the confirm dialog is dismissed", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const thread = makeThread({
      comments: [
        {
          commentId: "c2",
          text: "from alice",
          createdBy: user("alice", "Alice"),
          createdAt: new Date("2020-01-02T00:00:00Z"),
        },
      ],
    });
    mockUseThreadInfo.mockReturnValue({ threadInfo: thread, setThread: mockSetThread });
    render(<ThreadPage />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(mockDeleteComment).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("swallows errors from a failed delete without throwing", async () => {
    mockDeleteComment.mockRejectedValue(new Error("network down"));
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const thread = makeThread({
      comments: [
        {
          commentId: "c2",
          text: "from alice",
          createdBy: user("alice", "Alice"),
          createdAt: new Date("2020-01-02T00:00:00Z"),
        },
      ],
    });
    mockUseThreadInfo.mockReturnValue({ threadInfo: thread, setThread: mockSetThread });
    render(<ThreadPage />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(mockDeleteComment).toHaveBeenCalledTimes(1));
    // setThread is never called because the delete failed.
    expect(mockSetThread).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("starts a reply to a comment using its parsed body when its Reply button is clicked", () => {
    const thread = makeThread({
      comments: [
        {
          commentId: "c1",
          text: "↪ Alice: original\nactual body",
          createdBy: user("bob", "Bob"),
          createdAt: new Date("2020-01-02T00:00:00Z"),
        },
      ],
    });
    mockUseThreadInfo.mockReturnValue({ threadInfo: thread, setThread: mockSetThread });
    render(<ThreadPage />);

    // Two Reply buttons: the hero one and the comment one. Click the last.
    const replyButtons = screen.getAllByRole("button", { name: /Reply/ });
    fireEvent.click(replyButtons[replyButtons.length - 1]);
    expect(mockStartReply).toHaveBeenCalledWith({ sender: "Bob", text: "actual body" });
  });
});
