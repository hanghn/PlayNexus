// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import useAccessibility from "./useAccessibility";
import {
  AccessibilityContext,
  defaultPrefs,
  type AccessibilityContextValue,
} from "../contexts/AccessibilityContext.ts";

describe("useAccessibility", () => {
  it("throws when used outside an AccessibilityProvider", () => {
    expect(() => renderHook(() => useAccessibility())).toThrow(
      "useAccessibility must be used within an AccessibilityProvider",
    );
  });

  it("returns the context value when wrapped in a provider", () => {
    const value: AccessibilityContextValue = {
      ...defaultPrefs,
      set: () => {},
      speak: () => {},
      stopSpeaking: () => {},
      speechSupported: true,
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>
    );

    const { result } = renderHook(() => useAccessibility(), { wrapper });

    expect(result.current).toBe(value);
    expect(result.current.ttsRate).toBe(defaultPrefs.ttsRate);
    expect(result.current.speechSupported).toBe(true);
    expect(typeof result.current.set).toBe("function");
    expect(typeof result.current.speak).toBe("function");
    expect(typeof result.current.stopSpeaking).toBe("function");
  });
});
