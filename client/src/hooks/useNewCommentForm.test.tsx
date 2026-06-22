// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock useAuth so we control the auth object passed to addCommentToThread.
const useAuthMock = vi.fn();
vi.mock("./useAuth.ts", () => ({
  default: () => useAuthMock(),
}));

// Mock the thread service IO so no real network calls happen.
const addCommentToThreadMock = vi.fn();
vi.mock("../services/threadService.ts", () => ({
  addCommentToThread: (...args: unknown[]) => addCommentToThreadMock(...args),
}));

import useNewCommentForm from "./useNewCommentForm.ts";
import { encodeReply } from "../util/replyQuote.ts";

const auth = { username: "alice", password: "pw" };

const preventDefault = vi.fn();
const submitEvent = () =>
  ({ preventDefault }) as unknown as Parameters<
    ReturnType<typeof useNewCommentForm>["handleSubmit"]
  >[0];

const changeEvent = (value: string) =>
  ({ target: { value } }) as unknown as Parameters<
    ReturnType<typeof useNewCommentForm>["handleInputChange"]
  >[0];

const fakeThread = { _id: "t1", comments: [] } as never;

beforeEach(() => {
  vi.clearAllMocks();
  useAuthMock.mockReturnValue(auth);
  addCommentToThreadMock.mockResolvedValue(fakeThread);
});

describe("useNewCommentForm", () => {
  it("initializes with empty state", () => {
    const setThread = vi.fn();
    const { result } = renderHook(() => useNewCommentForm("t1", false, setThread));
    expect(result.current.comment).toBe("");
    expect(result.current.replyTo).toBeNull();
    expect(result.current.err).toBeNull();
  });

  it("handleInputChange updates the comment value", () => {
    const setThread = vi.fn();
    const { result } = renderHook(() => useNewCommentForm("t1", false, setThread));
    act(() => result.current.handleInputChange(changeEvent("hello world")));
    expect(result.current.comment).toBe("hello world");
  });

  it("setComment and setReplyTo update state", () => {
    const setThread = vi.fn();
    const { result } = renderHook(() => useNewCommentForm("t1", false, setThread));
    act(() => result.current.setComment("typed"));
    act(() => result.current.setReplyTo({ sender: "bob", text: "original" }));
    expect(result.current.comment).toBe("typed");
    expect(result.current.replyTo).toEqual({ sender: "bob", text: "original" });
  });

  it("rejects an empty/whitespace comment without calling the service", async () => {
    const setThread = vi.fn();
    const { result } = renderHook(() => useNewCommentForm("t1", false, setThread));
    act(() => result.current.setComment("   "));
    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });
    expect(preventDefault).toHaveBeenCalled();
    expect(result.current.err).toBe("Please put some text in the comment");
    expect(addCommentToThreadMock).not.toHaveBeenCalled();
    expect(setThread).not.toHaveBeenCalled();
  });

  it("rejects a low-effort 'first' comment when firstPost is true", async () => {
    const setThread = vi.fn();
    const { result } = renderHook(() => useNewCommentForm("t1", true, setThread));
    act(() => result.current.setComment("First!"));
    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });
    expect(result.current.err).toBe("Please put some effort into the comment");
    expect(addCommentToThreadMock).not.toHaveBeenCalled();
  });

  it("allows a 'first' comment when firstPost is false", async () => {
    const setThread = vi.fn();
    const { result } = renderHook(() => useNewCommentForm("t1", false, setThread));
    act(() => result.current.setComment("First!"));
    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });
    expect(addCommentToThreadMock).toHaveBeenCalledWith(auth, "t1", "First!");
    expect(result.current.err).toBeNull();
  });

  it("submits a plain comment, resets the form, and updates the parent thread", async () => {
    const setThread = vi.fn();
    const { result } = renderHook(() => useNewCommentForm("t1", false, setThread));
    act(() => result.current.setComment("a genuine comment"));
    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });
    expect(addCommentToThreadMock).toHaveBeenCalledWith(auth, "t1", "a genuine comment");
    expect(setThread).toHaveBeenCalledWith(fakeThread);
    expect(result.current.comment).toBe("");
    expect(result.current.replyTo).toBeNull();
    expect(result.current.err).toBeNull();
  });

  it("encodes the reply quote inline when replying to a comment", async () => {
    const setThread = vi.fn();
    const { result } = renderHook(() => useNewCommentForm("t1", false, setThread));
    act(() => result.current.setComment("my reply"));
    act(() => result.current.setReplyTo({ sender: "bob", text: "original message" }));
    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });
    const expectedBody = encodeReply("bob", "original message", "my reply");
    expect(addCommentToThreadMock).toHaveBeenCalledWith(auth, "t1", expectedBody);
    expect(result.current.replyTo).toBeNull();
  });

  it("surfaces service errors via err", async () => {
    addCommentToThreadMock.mockRejectedValue(new Error("boom"));
    const setThread = vi.fn();
    const { result } = renderHook(() => useNewCommentForm("t1", false, setThread));
    act(() => result.current.setComment("will fail"));
    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });
    expect(result.current.err).toBe("Error: boom");
    expect(setThread).not.toHaveBeenCalled();
    expect(result.current.comment).toBe("will fail");
  });
});
