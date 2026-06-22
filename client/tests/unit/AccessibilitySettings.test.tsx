// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AccessibilitySettings from "../../src/components/AccessibilitySettings.tsx";

const a11yState = vi.hoisted(() => ({
  ttsRate: 1.4,
  reduceMotion: true,
  highContrast: false,
  textScale: 110,
  speechSupported: true,
  set: vi.fn(),
  speak: vi.fn(),
  stopSpeaking: vi.fn(),
}));

vi.mock("../../src/hooks/useAccessibility.ts", () => ({
  default: () => ({
    ttsRate: a11yState.ttsRate,
    reduceMotion: a11yState.reduceMotion,
    highContrast: a11yState.highContrast,
    textScale: a11yState.textScale,
    set: a11yState.set,
    speak: a11yState.speak,
    stopSpeaking: a11yState.stopSpeaking,
    speechSupported: a11yState.speechSupported,
  }),
}));

beforeEach(() => {
  a11yState.ttsRate = 1.4;
  a11yState.reduceMotion = true;
  a11yState.highContrast = false;
  a11yState.textScale = 110;
  a11yState.speechSupported = true;
  a11yState.set.mockReset();
  a11yState.speak.mockReset();
  a11yState.stopSpeaking.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("AccessibilitySettings", () => {
  it("renders the current values and wires the controls to the accessibility hook", () => {
    render(<AccessibilitySettings />);

    const ttsRate = screen.getByRole("slider", { name: "Text-to-Speech rate" });
    const textSize = screen.getByRole("slider", { name: "Text size" });
    const previewButton = screen.getByRole("button", { name: "▶ Preview" });

    expect(ttsRate.getAttribute("value")).toBe("1.4");
    expect(textSize.getAttribute("value")).toBe("110");
    expect(screen.getByRole("switch", { name: "Reduce motion" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(screen.getByRole("switch", { name: "High contrast" }).getAttribute("aria-checked")).toBe(
      "false",
    );

    fireEvent.click(previewButton);
    expect(a11yState.speak).toHaveBeenCalledWith("This is a preview of the text to speech rate.");

    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(a11yState.stopSpeaking).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("switch", { name: "Reduce motion" }));
    expect(a11yState.set).toHaveBeenCalledWith({ reduceMotion: false });

    fireEvent.click(screen.getByRole("switch", { name: "High contrast" }));
    expect(a11yState.set).toHaveBeenCalledWith({ highContrast: true });
  });

  it("disables speech controls when speech synthesis is unavailable", () => {
    a11yState.speechSupported = false;

    render(<AccessibilitySettings />);

    expect(screen.getByRole("button", { name: "▶ Preview" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Your browser doesn’t support speech synthesis.").textContent).toBe(
      "Your browser doesn’t support speech synthesis.",
    );
  });
});
