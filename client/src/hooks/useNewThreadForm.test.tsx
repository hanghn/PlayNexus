// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

const mockNavigate = vi.fn();
const mockCreateThread = vi.fn();
const mockAuth = { username: "alice", password: "pw" };

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("./useAuth.ts", () => ({
  default: () => mockAuth,
}));

vi.mock("../services/threadService.ts", () => ({
  createThread: (...args: unknown[]) => mockCreateThread(...args),
}));

import type { SubmitEvent } from "react";
import useNewThreadForm from "./useNewThreadForm.ts";

function changeEvent(value: string) {
  return { target: { value } } as React.ChangeEvent<HTMLInputElement>;
}

function submitEvent() {
  const preventDefault = vi.fn();
  return { preventDefault } as unknown as React.FormEvent<HTMLFormElement> & {
    preventDefault: ReturnType<typeof vi.fn>;
  };
}

describe("useNewThreadForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with empty values and no error", () => {
    const { result } = renderHook(() => useNewThreadForm());
    expect(result.current.title).toBe("");
    expect(result.current.contents).toBe("");
    expect(result.current.err).toBeNull();
    expect(typeof result.current.handleInputChange).toBe("function");
    expect(typeof result.current.handleSubmit).toBe("function");
  });

  it("updates title and contents via handleInputChange", () => {
    const { result } = renderHook(() => useNewThreadForm());

    act(() => {
      result.current.handleInputChange(changeEvent("My Title"), "title");
    });
    expect(result.current.title).toBe("My Title");

    act(() => {
      result.current.handleInputChange(changeEvent("Some body text"), "contents");
    });
    expect(result.current.contents).toBe("Some body text");
  });

  it("ignores unknown fields without changing state", () => {
    const { result } = renderHook(() => useNewThreadForm());
    act(() => {
      result.current.handleInputChange(changeEvent("nope"), "other" as "title");
    });
    expect(result.current.title).toBe("");
    expect(result.current.contents).toBe("");
  });

  it("sets an error when the title is blank", async () => {
    const { result } = renderHook(() => useNewThreadForm());
    const e = submitEvent();

    act(() => {
      result.current.handleInputChange(changeEvent("   "), "title");
      result.current.handleInputChange(changeEvent("body"), "contents");
    });

    await act(async () => {
      await result.current.handleSubmit(e as unknown as SubmitEvent<HTMLFormElement>);
    });

    expect(e.preventDefault).toHaveBeenCalled();
    expect(result.current.err).toBe("A title is required");
    expect(mockCreateThread).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("sets an error when the contents are blank", async () => {
    const { result } = renderHook(() => useNewThreadForm());
    const e = submitEvent();

    act(() => {
      result.current.handleInputChange(changeEvent("A title"), "title");
      result.current.handleInputChange(changeEvent("   "), "contents");
    });

    await act(async () => {
      await result.current.handleSubmit(e as unknown as SubmitEvent<HTMLFormElement>);
    });

    expect(result.current.err).toBe("The post is required to have contents");
    expect(mockCreateThread).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("creates the thread and navigates on success", async () => {
    mockCreateThread.mockResolvedValue({ threadId: "abc123" });
    const { result } = renderHook(() => useNewThreadForm());
    const e = submitEvent();

    act(() => {
      result.current.handleInputChange(changeEvent("A title"), "title");
      result.current.handleInputChange(changeEvent("Body content"), "contents");
    });

    await act(async () => {
      await result.current.handleSubmit(e as unknown as SubmitEvent<HTMLFormElement>);
    });

    expect(mockCreateThread).toHaveBeenCalledWith(mockAuth, {
      title: "A title",
      text: "Body content",
    });
    expect(mockNavigate).toHaveBeenCalledWith("/forum/post/abc123");
    expect(result.current.err).toBeNull();
  });

  it("sets an error when createThread rejects", async () => {
    mockCreateThread.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useNewThreadForm());
    const e = submitEvent();

    act(() => {
      result.current.handleInputChange(changeEvent("A title"), "title");
      result.current.handleInputChange(changeEvent("Body content"), "contents");
    });

    await act(async () => {
      await result.current.handleSubmit(e as unknown as SubmitEvent<HTMLFormElement>);
    });

    expect(result.current.err).toBe("Error: boom");
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
