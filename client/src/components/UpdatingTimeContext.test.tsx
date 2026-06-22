// @vitest-environment jsdom
import { useContext } from "react";
import { render, screen, act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TimeContextKeeper from "./UpdatingTimeContext.tsx";
import { TimeContext } from "../contexts/TimeContext.tsx";

function TimeConsumer() {
  const time = useContext(TimeContext);
  return <span data-testid="time">{time.toISOString()}</span>;
}

describe("TimeContextKeeper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2020-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    // Unmount first (clears the component's own timeout), then drop any
    // remaining fake timers so scheduled updates never leak into the next test.
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders children and provides the initial time", () => {
    render(
      <TimeContextKeeper updateFrequency={1000}>
        <TimeConsumer />
      </TimeContextKeeper>,
    );

    expect(screen.getByTestId("time").textContent).toBe("2020-01-01T00:00:00.000Z");
  });

  it("updates the provided time after the update frequency elapses", () => {
    render(
      <TimeContextKeeper updateFrequency={1000}>
        <TimeConsumer />
      </TimeContextKeeper>,
    );

    expect(screen.getByTestId("time").textContent).toBe("2020-01-01T00:00:00.000Z");

    // Advancing the fake clock also advances Date, so when the scheduled
    // timeout fires `new Date()` reflects the elapsed time.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId("time").textContent).toBe("2020-01-01T00:00:01.000Z");

    // The timeout reschedules itself, so a second interval updates again.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId("time").textContent).toBe("2020-01-01T00:00:02.000Z");
  });

  it("clears the pending timeout on unmount", () => {
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    const { unmount } = render(
      <TimeContextKeeper updateFrequency={5000}>
        <TimeConsumer />
      </TimeContextKeeper>,
    );

    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });

  it("reschedules when updateFrequency changes", () => {
    const { rerender } = render(
      <TimeContextKeeper updateFrequency={1000}>
        <TimeConsumer />
      </TimeContextKeeper>,
    );

    rerender(
      <TimeContextKeeper updateFrequency={2000}>
        <TimeConsumer />
      </TimeContextKeeper>,
    );

    // The old 1000ms timer was cleared; nothing fires before the new 2000ms one.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId("time").textContent).toBe("2020-01-01T00:00:00.000Z");

    // After the full new frequency elapses, the context updates.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId("time").textContent).toBe("2020-01-01T00:00:02.000Z");
  });
});
