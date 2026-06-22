// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef, useContext } from "react";
import { MemoryRouter } from "react-router-dom";
import type { ThreadInfo, ThreadSummary } from "@gamenite/shared";
import NewForumComment, {
  type CommentComposerHandle,
} from "../../src/components/NewForumComment.tsx";
import ThreadSummaryView from "../../src/components/ThreadSummaryView.tsx";
import UpdatingTimeContext from "../../src/components/UpdatingTimeContext.tsx";
import UserChip from "../../src/components/UserChip.tsx";
import { TimeContext } from "../../src/contexts/TimeContext.tsx";
import { encodeReply } from "../../src/util/replyQuote.ts";

const forumState = vi.hoisted(() => ({
  navigate: vi.fn(),
  addCommentToThread: vi.fn(() => ({ threadId: "t1" }) as ThreadInfo),
}));

vi.mock("../../src/hooks/useAuth.ts", () => ({
  default: () => ({ username: "bob", password: "secret" }),
}));

vi.mock("../../src/services/threadService.ts", () => ({
  addCommentToThread: forumState.addCommentToThread,
}));

vi.mock("../../src/hooks/useTimeSince.ts", () => ({
  default: () => () => "just now",
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => forumState.navigate,
  };
});

vi.mock("../../src/components/EmojiPicker.tsx", () => ({
  default: ({ onSelect, large }: { onSelect: (emoji: string) => void; large?: boolean }) => (
    <button
      type="button"
      aria-label={large ? "emoji-large" : "emoji"}
      onClick={() => onSelect("🙂")}
    >
      emoji
    </button>
  ),
}));

afterEach(() => {
  cleanup();
  forumState.navigate.mockReset();
  forumState.addCommentToThread.mockClear();
});

describe("UserChip", () => {
  it("links to the profile by default and can render a non-linked avatar", () => {
    const { container } = render(
      <MemoryRouter>
        <UserChip user={{ username: "bob", display: "Bob" }} />
      </MemoryRouter>,
    );

    expect(container.querySelector("a.userChip-link")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();

    const { container: noLink } = render(
      <UserChip
        user={{ username: "bob", display: "Bob", avatarUrl: "https://example.com/bob.png" }}
        link={false}
        showName={false}
      />,
    );

    expect(noLink.querySelector("a")).toBeNull();
    expect(noLink.querySelector("img.userChip-avatar--img")).toBeTruthy();
  });
});

describe("ThreadSummaryView", () => {
  const summary: ThreadSummary = {
    threadId: "thread-1",
    createdBy: { username: "doris", display: "Doris", createdAt: new Date() },
    createdAt: new Date(),
    title: "How do I win Nim?",
    comments: 2,
  };

  it("navigates to the thread and shows the reply count", () => {
    render(
      <MemoryRouter>
        <ThreadSummaryView {...summary} />
      </MemoryRouter>,
    );

    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("replies")).toBeTruthy();

    const row = screen.getByRole("listitem");
    fireEvent.click(row);
    expect(forumState.navigate).toHaveBeenCalledWith("/forum/post/thread-1");

    fireEvent.keyDown(row, { key: "Enter" });
    expect(forumState.navigate).toHaveBeenCalledWith("/forum/post/thread-1");
  });

  it("uses the singular form when there is one reply", () => {
    render(
      <MemoryRouter>
        <ThreadSummaryView {...summary} comments={1} />
      </MemoryRouter>,
    );

    expect(screen.getByText("reply")).toBeTruthy();
  });
});

describe("NewForumComment", () => {
  it("submits a comment and supports reply quoting", async () => {
    const setThread = vi.fn();
    const ref = createRef<CommentComposerHandle>();

    render(
      <MemoryRouter>
        <NewForumComment ref={ref} threadId="t1" firstPost={false} setThread={setThread} />
      </MemoryRouter>,
    );

    act(() => {
      ref.current?.startReply({ sender: "Doris", text: "play Nim?" });
    });

    expect(screen.getByText("Replying to")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Reply to Doris"), { target: { value: "sure" } });
    fireEvent.click(screen.getByRole("button", { name: "emoji-large" }));
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));

    await waitFor(() =>
      expect(forumState.addCommentToThread).toHaveBeenCalledWith(
        { username: "bob", password: "secret" },
        "t1",
        encodeReply("Doris", "play Nim?", "sure🙂"),
      ),
    );
    expect(setThread).toHaveBeenCalledWith({ threadId: "t1" });
  });

  it("shows the first-post placeholder and blocks empty submissions", () => {
    render(
      <MemoryRouter>
        <NewForumComment threadId="t1" firstPost={true} setThread={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByPlaceholderText("Be the first to comment")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Comment" }).hasAttribute("disabled")).toBe(true);
  });
});

describe("UpdatingTimeContext", () => {
  it("refreshes the time base on the configured interval", () => {
    vi.useFakeTimers();

    function Reader() {
      const current = useContext(TimeContext);
      return <div data-testid="stamp">{current.toISOString()}</div>;
    }

    render(
      <UpdatingTimeContext updateFrequency={1000}>
        <Reader />
      </UpdatingTimeContext>,
    );

    const first = screen.getByTestId("stamp").textContent;
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const second = screen.getByTestId("stamp").textContent;

    expect(second).not.toBe(first);
    vi.useRealTimers();
  });
});
