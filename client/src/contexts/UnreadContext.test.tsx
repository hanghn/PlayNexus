// @vitest-environment jsdom
import { useContext } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, renderHook, screen } from "@testing-library/react";
import { UnreadContext, type UnreadContextValue } from "./UnreadContext";

describe("UnreadContext", () => {
  it("defaults to null when no provider is mounted", () => {
    const { result } = renderHook(() => useContext(UnreadContext));
    expect(result.current).toBeNull();
  });

  it("provides the supplied value to consumers", () => {
    const markThreadRead = vi.fn();
    const value: UnreadContextValue = {
      counts: { "thread-1": 3, "thread-2": 1 },
      total: 4,
      markThreadRead,
    };

    const { result } = renderHook(() => useContext(UnreadContext), {
      wrapper: ({ children }) => (
        <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>
      ),
    });

    expect(result.current).not.toBeNull();
    expect(result.current?.total).toBe(4);
    expect(result.current?.counts["thread-1"]).toBe(3);

    result.current?.markThreadRead("thread-1");
    expect(markThreadRead).toHaveBeenCalledWith("thread-1");
  });

  it("renders consumed values into the DOM via Consumer", () => {
    const value: UnreadContextValue = {
      counts: { a: 2 },
      total: 2,
      markThreadRead: vi.fn(),
    };

    render(
      <UnreadContext.Provider value={value}>
        <UnreadContext.Consumer>
          {(ctx) => <span data-testid="total">{ctx?.total ?? "none"}</span>}
        </UnreadContext.Consumer>
      </UnreadContext.Provider>,
    );

    expect(screen.getByTestId("total").textContent).toBe("2");
  });
});
