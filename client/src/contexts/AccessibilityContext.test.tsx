// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { useContext } from "react";
import { render } from "@testing-library/react";
import {
  AccessibilityContext,
  defaultPrefs,
  type AccessibilityContextValue,
} from "./AccessibilityContext";

describe("AccessibilityContext", () => {
  it("exposes sensible default preferences", () => {
    expect(defaultPrefs).toEqual({
      ttsRate: 1,
      reduceMotion: false,
      highContrast: false,
      textScale: 100,
    });
    expect(defaultPrefs.ttsRate).toBeGreaterThanOrEqual(0.5);
    expect(defaultPrefs.ttsRate).toBeLessThanOrEqual(2.0);
    expect(defaultPrefs.textScale).toBeGreaterThanOrEqual(90);
    expect(defaultPrefs.textScale).toBeLessThanOrEqual(150);
  });

  it("creates a React context defaulting to null", () => {
    let captured: AccessibilityContextValue | null | undefined;
    function Probe() {
      captured = useContext(AccessibilityContext);
      return null;
    }
    render(<Probe />);
    expect(captured).toBeNull();
  });

  it("provides a value to consumers via its Provider", () => {
    const value: AccessibilityContextValue = {
      ...defaultPrefs,
      set: () => {},
      speak: () => {},
      stopSpeaking: () => {},
      speechSupported: true,
    };

    let captured: AccessibilityContextValue | null | undefined;
    function Probe() {
      captured = useContext(AccessibilityContext);
      return null;
    }
    render(
      <AccessibilityContext.Provider value={value}>
        <Probe />
      </AccessibilityContext.Provider>,
    );
    expect(captured).toBe(value);
    expect(captured?.speechSupported).toBe(true);
    expect(typeof captured?.set).toBe("function");
  });
});
