// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AccessibilityProvider from "../../src/components/AccessibilityProvider.tsx";
import useAccessibility from "../../src/hooks/useAccessibility.ts";

const STORAGE_KEY = "playnexus.a11y";

function Probe() {
  const a11y = useAccessibility();

  return (
    <div>
      <div
        data-testid="prefs"
        data-tts-rate={a11y.ttsRate}
        data-reduce-motion={String(a11y.reduceMotion)}
        data-high-contrast={String(a11y.highContrast)}
        data-text-scale={a11y.textScale}
        data-speech-supported={String(a11y.speechSupported)}
      />
      <button type="button" onClick={() => a11y.speak("Preview text")}>
        Speak
      </button>
      <button type="button" onClick={() => a11y.speak("   ")}>
        SpeakBlank
      </button>
      <button type="button" onClick={a11y.stopSpeaking}>
        Stop
      </button>
      <button type="button" onClick={() => a11y.set({ textScale: 150, reduceMotion: true })}>
        Scale up
      </button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute("data-reduce-motion");
  document.documentElement.removeAttribute("data-contrast");
  document.documentElement.style.fontSize = "";
  vi.unstubAllGlobals();
});

describe("AccessibilityProvider", () => {
  it("loads saved preferences and applies them to the root element", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ttsRate: 1.6, reduceMotion: true, highContrast: true, textScale: 125 }),
    );

    render(
      <AccessibilityProvider>
        <Probe />
      </AccessibilityProvider>,
    );

    await waitFor(() => {
      expect(document.documentElement.style.fontSize).toBe("125%");
    });

    const prefs = screen.getByTestId("prefs");
    expect(prefs.getAttribute("data-tts-rate")).toBe("1.6");
    expect(prefs.getAttribute("data-reduce-motion")).toBe("true");
    expect(prefs.getAttribute("data-high-contrast")).toBe("true");
    expect(prefs.getAttribute("data-text-scale")).toBe("125");
    expect(document.documentElement.dataset.reduceMotion).toBe("true");
    expect(document.documentElement.dataset.contrast).toBe("high");
  });

  it("exposes speech synthesis helpers at the current rate", () => {
    class MockUtterance {
      text: string;
      rate = 1;

      constructor(text: string) {
        this.text = text;
      }
    }

    const cancel = vi.fn();
    const speak = vi.fn();
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
    vi.stubGlobal("speechSynthesis", { cancel, speak });

    render(
      <AccessibilityProvider>
        <Probe />
      </AccessibilityProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Speak" }));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith(expect.objectContaining({ text: "Preview text", rate: 1 }));

    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it("falls back to defaults when saved prefs are not valid JSON", () => {
    localStorage.setItem(STORAGE_KEY, "not-json{");

    render(
      <AccessibilityProvider>
        <Probe />
      </AccessibilityProvider>,
    );

    const prefs = screen.getByTestId("prefs");
    expect(prefs.getAttribute("data-text-scale")).toBe("100");
    expect(prefs.getAttribute("data-reduce-motion")).toBe("false");
  });

  it("updates preferences through set() and re-applies them to the root", async () => {
    render(
      <AccessibilityProvider>
        <Probe />
      </AccessibilityProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Scale up" }));

    await waitFor(() => {
      expect(document.documentElement.style.fontSize).toBe("150%");
    });
    expect(screen.getByTestId("prefs").getAttribute("data-text-scale")).toBe("150");
    expect(document.documentElement.dataset.reduceMotion).toBe("true");
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(saved.textScale).toBe(150);
  });

  it("ignores speech helpers when speech synthesis is unavailable", () => {
    // jsdom has no speechSynthesis, so `"speechSynthesis" in window` is false here.
    render(
      <AccessibilityProvider>
        <Probe />
      </AccessibilityProvider>,
    );

    expect(screen.getByTestId("prefs").getAttribute("data-speech-supported")).toBe("false");
    // No throw when speech is unsupported.
    fireEvent.click(screen.getByRole("button", { name: "Speak" }));
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
  });

  it("does not speak blank text", () => {
    const cancel = vi.fn();
    const speak = vi.fn();
    vi.stubGlobal("SpeechSynthesisUtterance", class {});
    vi.stubGlobal("speechSynthesis", { cancel, speak });

    render(
      <AccessibilityProvider>
        <Probe />
      </AccessibilityProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "SpeakBlank" }));
    expect(speak).not.toHaveBeenCalled();
  });
});
