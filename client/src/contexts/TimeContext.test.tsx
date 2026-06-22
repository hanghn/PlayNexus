// @vitest-environment jsdom
import { useContext } from "react";
import { render, renderHook, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TimeContext } from "./TimeContext";

describe("TimeContext", () => {
  it("provides a Date as its default value", () => {
    const { result } = renderHook(() => useContext(TimeContext));
    expect(result.current).toBeInstanceOf(Date);
    expect(Number.isNaN(result.current.getTime())).toBe(false);
  });

  it("supplies the value passed to its Provider to consumers", () => {
    const fixed = new Date("2026-06-16T12:00:00.000Z");

    function Consumer() {
      const time = useContext(TimeContext);
      return <span data-testid="time">{time.toISOString()}</span>;
    }

    render(
      <TimeContext.Provider value={fixed}>
        <Consumer />
      </TimeContext.Provider>,
    );

    expect(screen.getByTestId("time").textContent).toBe("2026-06-16T12:00:00.000Z");
  });

  it("exposes Provider and Consumer components", () => {
    expect(TimeContext.Provider).toBeDefined();
    expect(TimeContext.Consumer).toBeDefined();
  });
});
