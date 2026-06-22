// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

// ---- Router mocks -------------------------------------------------------
const navigateMock = vi.fn();
let paramsMock: { threadId?: string } = {};
vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
  useParams: () => paramsMock,
}));

// ---- Login context mock -------------------------------------------------
let userMock: { username: string } = { username: "me" };
vi.mock("../hooks/useLoginContext.ts", () => ({
  default: () => ({ user: userMock }),
}));

// ---- useDMThread mock ---------------------------------------------------
const sendMock = vi.fn();
const deleteMessageMock = vi.fn();
let dmThreadReturn: {
  thread: unknown;
  error: string | null;
  send: (t: string) => void;
  deleteMessage: (id: string) => void;
};
const useDMThreadSpy = vi.fn((id: string) => {
  void id;
  return dmThreadReturn;
});
vi.mock("../hooks/useDMThread.ts", () => ({
  default: (id: string) => useDMThreadSpy(id),
}));

// ---- Child component mocks (avoid pulling in their own providers) -------
const messageListProps = vi.fn();
vi.mock("../components/MessageList.tsx", () => ({
  default: (props: {
    messages: unknown[];
    onReply: (t: unknown) => void;
    onDelete: (id: string) => void;
  }) => {
    messageListProps(props);
    return (
      <div data-testid="message-list">
        <button
          data-testid="reply-btn"
          onClick={() => props.onReply({ sender: "alice", text: "hey" })}
        >
          reply
        </button>
        <button data-testid="delete-btn" onClick={() => props.onDelete("m1")}>
          delete
        </button>
      </div>
    );
  },
}));

const startReplyMock = vi.fn();
vi.mock("../components/MessageCreation.tsx", async () => {
  const react = await import("react");
  return {
    __esModule: true,
    default: react.forwardRef(
      (props: { handleMessageCreation: (t: string) => void }, ref: React.Ref<unknown>) => {
        react.useImperativeHandle(ref, () => ({ startReply: startReplyMock }));
        return (
          <button
            data-testid="composer-send"
            aria-label="Send message"
            onClick={() => props.handleMessageCreation("hi there")}
          >
            send
          </button>
        );
      },
    ),
  };
});

import type React from "react";
import DMThread from "./DMThread.tsx";

function makeThread(overrides: Record<string, unknown> = {}) {
  return {
    participants: [
      {
        username: "me",
        display: "Me",
        avatarUrl: null,
        accentColor: null,
      },
      {
        username: "alice",
        display: "Alice",
        avatarUrl: null,
        accentColor: null,
      },
    ],
    messages: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  paramsMock = {};
  userMock = { username: "me" };
  dmThreadReturn = {
    thread: makeThread(),
    error: null,
    send: sendMock,
    deleteMessage: deleteMessageMock,
  };
});

afterEach(() => {
  cleanup();
});

describe("DMThread", () => {
  it("renders an error state when the hook reports an error", () => {
    dmThreadReturn = {
      thread: null,
      error: "boom",
      send: sendMock,
      deleteMessage: deleteMessageMock,
    };
    render(<DMThread threadId="t1" />);
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(document.querySelector(".dm-pane--state")).toBeTruthy();
  });

  it("renders a loading state when there is no thread yet", () => {
    dmThreadReturn = {
      thread: null,
      error: null,
      send: sendMock,
      deleteMessage: deleteMessageMock,
    };
    render(<DMThread threadId="t1" />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("uses the prop threadId when provided", () => {
    render(<DMThread threadId="prop-thread" />);
    expect(useDMThreadSpy).toHaveBeenCalledWith("prop-thread");
  });

  it("falls back to the route param threadId when no prop is given", () => {
    paramsMock = { threadId: "route-thread" };
    render(<DMThread />);
    expect(useDMThreadSpy).toHaveBeenCalledWith("route-thread");
  });

  it("falls back to an empty string when neither prop nor param is present", () => {
    render(<DMThread />);
    expect(useDMThreadSpy).toHaveBeenCalledWith("");
  });

  it("shows the other participant's display name and handle", () => {
    render(<DMThread threadId="t1" />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("@alice")).toBeInTheDocument();
  });

  it("renders a generated-accent avatar with the initial when there is no avatarUrl", () => {
    render(<DMThread threadId="t1" />);
    const avatar = document.querySelector(".dm-thread-avatar");
    expect(avatar).toBeTruthy();
    expect(avatar?.textContent).toBe("A");
    // accentFor produced a background from the CSS-var palette
    expect((avatar as HTMLElement).style.background).toContain("var(--");
  });

  it("renders an <img> avatar when avatarUrl is present and applies accent box-shadow", () => {
    dmThreadReturn.thread = makeThread({
      participants: [
        { username: "me", display: "Me", avatarUrl: null, accentColor: null },
        {
          username: "alice",
          display: "Alice",
          avatarUrl: "http://example.com/a.png",
          accentColor: "#123456",
        },
      ],
    });
    render(<DMThread threadId="t1" />);
    const img = document.querySelector("img.dm-thread-avatar") as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toBe("http://example.com/a.png");
    expect(img.style.boxShadow).toContain("#123456");
  });

  it("navigates back to the inbox when the back button is clicked", () => {
    render(<DMThread threadId="t1" />);
    fireEvent.click(screen.getByLabelText("Back to inbox"));
    expect(navigateMock).toHaveBeenCalledWith("/messages");
  });

  it("falls back to the first participant when the user is not among participants", () => {
    userMock = { username: "stranger" };
    render(<DMThread threadId="t1" />);
    // "Me" is participants[0], so it is treated as the other party
    expect(screen.getByText("Me")).toBeInTheDocument();
    expect(screen.getByText("@me")).toBeInTheDocument();
  });

  it("computes the initial from username when display is empty", () => {
    dmThreadReturn.thread = makeThread({
      participants: [
        { username: "me", display: "Me", avatarUrl: null, accentColor: null },
        { username: "bob", display: "", avatarUrl: null, accentColor: null },
      ],
    });
    render(<DMThread threadId="t1" />);
    const avatar = document.querySelector(".dm-thread-avatar");
    expect(avatar?.textContent).toBe("B");
  });

  it("passes the hook's send to the composer", () => {
    render(<DMThread threadId="t1" />);
    fireEvent.click(screen.getByLabelText("Send message"));
    expect(sendMock).toHaveBeenCalledWith("hi there");
  });

  it("passes deleteMessage and onReply through MessageList", () => {
    render(<DMThread threadId="t1" />);
    fireEvent.click(screen.getByTestId("delete-btn"));
    expect(deleteMessageMock).toHaveBeenCalledWith("m1");

    fireEvent.click(screen.getByTestId("reply-btn"));
    expect(startReplyMock).toHaveBeenCalledWith({ sender: "alice", text: "hey" });
  });

  it("forwards the thread's messages to MessageList", () => {
    dmThreadReturn.thread = makeThread({ messages: [{ messageId: "x" }] });
    render(<DMThread threadId="t1" />);
    expect(messageListProps).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [{ messageId: "x" }] }),
    );
  });
});
