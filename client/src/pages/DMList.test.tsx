// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { MemoryRouter } from "react-router-dom";
import type { DMThreadInfo } from "@gamenite/shared";

expect.extend(matchers);

// ----- Router mock (useNavigate / useParams) -----
const navigateMock = vi.fn();
let paramsMock: { threadId?: string } = {};
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => paramsMock,
  };
});

// ----- Hook mocks -----
const loginCtx = { user: { username: "me" } };
vi.mock("../hooks/useLoginContext.ts", () => ({
  default: () => loginCtx,
}));
vi.mock("../hooks/useAuth.ts", () => ({
  default: () => ({ username: "me", password: "pw" }),
}));

let dmListReturn: { threads: DMThreadInfo[] | null; error: string | null } = {
  threads: null,
  error: null,
};
vi.mock("../hooks/useDMList.ts", () => ({
  default: () => dmListReturn,
}));

const markThreadRead = vi.fn();
let unreadCounts: Record<string, number> = {};
vi.mock("../hooks/useUnread.ts", () => ({
  default: () => ({ counts: unreadCounts, markThreadRead }),
}));

// ----- Service mocks -----
const openDMThread = vi.fn();
vi.mock("../services/dmService.ts", () => ({
  openDMThread: (...args: unknown[]) => openDMThread(...args),
}));
vi.mock("../services/api.ts", () => ({
  api: {},
  apiErrorMessage: (_err: unknown, fallback: string) => fallback,
}));

// ----- Child component mock -----
vi.mock("./DMThread.tsx", () => ({
  default: ({ threadId }: { threadId: string }) => (
    <div data-testid="dm-thread">thread:{threadId}</div>
  ),
}));

import DMList from "./DMList.tsx";

function makeThread(id: string, opts: Partial<DMThreadInfo> = {}): DMThreadInfo {
  return {
    threadId: id,
    participants: [
      { username: "me", display: "Me" },
      { username: `other-${id}`, display: `Other ${id}` },
    ],
    messages: [],
    ...opts,
  } as unknown as DMThreadInfo;
}

function renderList() {
  return render(
    <MemoryRouter>
      <DMList />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  navigateMock.mockResolvedValue(undefined);
  paramsMock = {};
  dmListReturn = { threads: null, error: null };
  unreadCounts = {};
});

describe("DMList", () => {
  it("renders the error state when useDMList reports an error", () => {
    dmListReturn = { threads: null, error: "boom" };
    renderList();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("shows the loading note when threads are null", () => {
    dmListReturn = { threads: null, error: null };
    renderList();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows the empty note when there are no threads", () => {
    dmListReturn = { threads: [], error: null };
    renderList();
    expect(screen.getByText("No conversations yet — message someone above.")).toBeInTheDocument();
  });

  it("renders the empty conversation pane when no threadId is selected", () => {
    dmListReturn = { threads: [], error: null };
    renderList();
    expect(screen.getByText("Pick a conversation, or start a new one.")).toBeInTheDocument();
    expect(screen.queryByTestId("dm-thread")).not.toBeInTheDocument();
  });

  it("renders DMThread when a threadId param is present", () => {
    paramsMock = { threadId: "t1" };
    dmListReturn = { threads: [makeThread("t1")], error: null };
    renderList();
    expect(screen.getByTestId("dm-thread")).toHaveTextContent("thread:t1");
  });

  it("renders a thread row with the other participant's display name and empty preview", () => {
    dmListReturn = { threads: [makeThread("t1")], error: null };
    renderList();
    expect(screen.getByText("Other t1")).toBeInTheDocument();
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });

  it("shows the last message preview and a 'You:' prefix when authored by me", () => {
    const t = makeThread("t1", {
      messages: [{ text: "hello there", createdBy: { username: "me" } }],
    } as Partial<DMThreadInfo>);
    dmListReturn = { threads: [t], error: null };
    renderList();
    expect(screen.getByText(/You:/)).toBeInTheDocument();
    expect(screen.getByText(/hello there/)).toBeInTheDocument();
  });

  it("shows the unread badge (capped at 9+)", () => {
    dmListReturn = { threads: [makeThread("t1"), makeThread("t2")], error: null };
    unreadCounts = { t1: 3, t2: 42 };
    renderList();
    expect(screen.getByLabelText("3 unread")).toHaveTextContent("3");
    expect(screen.getByLabelText("42 unread")).toHaveTextContent("9+");
  });

  it("renders an avatar image when avatarUrl is present", () => {
    const t = makeThread("t1", {
      participants: [
        { username: "me", display: "Me" },
        { username: "bob", display: "Bob", avatarUrl: "http://img/x.png", accentColor: "#fff" },
      ],
    } as Partial<DMThreadInfo>);
    dmListReturn = { threads: [t], error: null };
    const { container } = renderList();
    expect(container.querySelector("img.dm-avatar-img")).toHaveAttribute("src", "http://img/x.png");
  });

  it("marks the thread read and navigates when a row is clicked", () => {
    dmListReturn = { threads: [makeThread("t1")], error: null };
    renderList();
    fireEvent.click(screen.getByRole("button", { name: /Other t1/ }));
    expect(markThreadRead).toHaveBeenCalledWith("t1");
    expect(navigateMock).toHaveBeenCalledWith("/messages/t1");
  });

  it("disables the Go button until input has non-whitespace content", () => {
    dmListReturn = { threads: [], error: null };
    renderList();
    const go = screen.getByRole("button", { name: "Go" });
    expect(go).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Message a username"), {
      target: { value: " alice " },
    });
    expect(go).toBeEnabled();
  });

  it("opens a new DM thread on submit and navigates to it", async () => {
    openDMThread.mockResolvedValue({ threadId: "new-thread" });
    dmListReturn = { threads: [], error: null };
    renderList();
    const input = screen.getByLabelText("Message a username");
    fireEvent.change(input, { target: { value: " alice " } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));

    await waitFor(() => {
      expect(openDMThread).toHaveBeenCalledWith({ username: "me", password: "pw" }, "alice");
    });
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/messages/new-thread");
    });
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("shows an error message when opening a DM fails", async () => {
    openDMThread.mockRejectedValue(new Error("nope"));
    dmListReturn = { threads: [], error: null };
    renderList();
    fireEvent.change(screen.getByLabelText("Message a username"), {
      target: { value: "ghost" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(await screen.findByText("User not found")).toBeInTheDocument();
  });
});
