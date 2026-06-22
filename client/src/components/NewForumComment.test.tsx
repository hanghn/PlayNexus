// @vitest-environment jsdom
import { createRef } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import NewForumComment, { type CommentComposerHandle } from "./NewForumComment.tsx";
import type { CommentReplyTarget } from "../hooks/useNewCommentForm.ts";

// State driving the mocked hook; reset before each test.
let comment = "";
let replyTo: CommentReplyTarget | null = null;
let err: string | null = null;

const setComment = vi.fn();
const setReplyTo = vi.fn();
const handleSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
const handleInputChange = vi.fn();

// Mock the form hook so the component renders without auth/network deps.
vi.mock("../hooks/useNewCommentForm.ts", () => ({
  __esModule: true,
  default: () => ({
    comment,
    setComment,
    replyTo,
    setReplyTo,
    err,
    handleSubmit,
    handleInputChange,
  }),
}));

const setThread = vi.fn();

function renderComposer(firstPost = false) {
  const ref = createRef<CommentComposerHandle>();
  const utils = render(
    <NewForumComment ref={ref} threadId="t1" firstPost={firstPost} setThread={setThread} />,
  );
  return { ref, ...utils };
}

describe("NewForumComment", () => {
  beforeEach(() => {
    cleanup();
    comment = "";
    replyTo = null;
    err = null;
    vi.clearAllMocks();
  });

  it("renders the default placeholder when not the first post", () => {
    renderComposer(false);
    const textarea = screen.getByLabelText("Add a comment");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute("placeholder", "Add a comment");
  });

  it("renders the first-post placeholder when firstPost is true", () => {
    renderComposer(true);
    const textarea = screen.getByLabelText("Add a comment");
    expect(textarea).toHaveAttribute("placeholder", "Be the first to comment");
  });

  it("disables the submit button when the comment is blank/whitespace", () => {
    comment = "   ";
    renderComposer();
    expect(screen.getByRole("button", { name: "Comment" })).toBeDisabled();
  });

  it("enables the submit button when there is text", () => {
    comment = "hello";
    renderComposer();
    expect(screen.getByRole("button", { name: "Comment" })).not.toBeDisabled();
  });

  it("forwards textarea changes to handleInputChange", () => {
    renderComposer();
    fireEvent.change(screen.getByLabelText("Add a comment"), { target: { value: "hi" } });
    expect(handleInputChange).toHaveBeenCalledTimes(1);
  });

  it("calls handleSubmit when the form is submitted", () => {
    comment = "hello";
    renderComposer();
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows the error message when err is present", () => {
    err = "Please put some text in the comment";
    renderComposer();
    expect(screen.getByText("Please put some text in the comment")).toBeInTheDocument();
  });

  it("shows the reply header and updates the placeholder when replying", () => {
    replyTo = { sender: "alice", text: "original" };
    renderComposer();
    expect(screen.getByText("alice")).toBeInTheDocument();
    const textarea = screen.getByLabelText("Reply to alice");
    expect(textarea).toHaveAttribute("placeholder", "Reply to alice");
  });

  it("clears the reply target when Cancel is clicked", () => {
    replyTo = { sender: "bob", text: "hey" };
    renderComposer();
    fireEvent.click(screen.getByRole("button", { name: "Cancel reply" }));
    expect(setReplyTo).toHaveBeenCalledWith(null);
  });

  it("exposes a startReply imperative handle that sets the reply target", () => {
    const { ref } = renderComposer();
    const target: CommentReplyTarget = { sender: "carol", text: "msg" };
    ref.current?.startReply(target);
    expect(setReplyTo).toHaveBeenCalledWith(target);
  });

  it("inserts a selected emoji via setComment updater", () => {
    renderComposer();
    fireEvent.click(screen.getByRole("button", { name: "Insert emoji" }));
    fireEvent.click(screen.getByRole("button", { name: "Emoji 👍" }));
    expect(setComment).toHaveBeenCalledTimes(1);
    // The component passes an updater function: (c) => c + emoji
    const updater = setComment.mock.calls[0][0] as (c: string) => string;
    expect(updater("abc")).toBe("abc👍");
  });
});
