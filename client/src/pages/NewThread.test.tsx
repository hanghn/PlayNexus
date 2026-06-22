// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

const mockNavigate = vi.fn();
const mockCreateThread = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../services/threadService.ts", () => ({
  createThread: (...args: unknown[]) => mockCreateThread(...args),
}));

vi.mock("../hooks/useLoginContext.ts", () => ({
  default: () => ({
    user: { username: "alice" },
    pass: "secret",
    socket: {},
    reset: vi.fn(),
    onlineUsers: new Set<string>(),
  }),
}));

import NewThread from "./NewThread.tsx";

function getTitleInput() {
  return screen.getByLabelText("Title");
}
function getContentsInput() {
  return screen.getByLabelText("Post contents");
}

describe("NewThread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the form heading and inputs", () => {
    render(<NewThread />);
    expect(screen.getByRole("heading", { name: "Create new post" })).toBeInTheDocument();
    expect(getTitleInput()).toHaveValue("");
    expect(getContentsInput()).toHaveValue("");
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });

  it("updates title and contents on change", () => {
    render(<NewThread />);
    fireEvent.change(getTitleInput(), { target: { value: "My Title" } });
    fireEvent.change(getContentsInput(), { target: { value: "My body" } });
    expect(getTitleInput()).toHaveValue("My Title");
    expect(getContentsInput()).toHaveValue("My body");
  });

  it("shows an error when the title is empty on submit", async () => {
    render(<NewThread />);
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("A title is required")).toBeInTheDocument();
    expect(mockCreateThread).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows an error when contents are empty on submit", async () => {
    render(<NewThread />);
    fireEvent.change(getTitleInput(), { target: { value: "A title" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("The post is required to have contents")).toBeInTheDocument();
    expect(mockCreateThread).not.toHaveBeenCalled();
  });

  it("creates the thread and navigates on a successful submit", async () => {
    mockCreateThread.mockResolvedValue({ threadId: "t-123" });
    render(<NewThread />);
    fireEvent.change(getTitleInput(), { target: { value: "Hello" } });
    fireEvent.change(getContentsInput(), { target: { value: "World" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(mockCreateThread).toHaveBeenCalledTimes(1));
    expect(mockCreateThread).toHaveBeenCalledWith(
      { username: "alice", password: "secret" },
      { title: "Hello", text: "World" },
    );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/forum/post/t-123"));
  });

  it("displays the error when createThread rejects", async () => {
    mockCreateThread.mockRejectedValue(new Error("boom"));
    render(<NewThread />);
    fireEvent.change(getTitleInput(), { target: { value: "Hello" } });
    fireEvent.change(getContentsInput(), { target: { value: "World" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Error: boom")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
