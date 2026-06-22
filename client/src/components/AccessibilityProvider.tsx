import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AccessibilityContext,
  defaultPrefs,
  type AccessibilityPrefs,
} from "../contexts/AccessibilityContext.ts";

const STORAGE_KEY = "playnexus.a11y";

/** Load saved prefs, falling back to defaults for anything missing/invalid. */
function loadPrefs(): AccessibilityPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPrefs;
    const parsed = JSON.parse(raw) as Partial<AccessibilityPrefs>;
    return { ...defaultPrefs, ...parsed };
  } catch {
    return defaultPrefs;
  }
}

/**
 * Provides accessibility preferences to the whole app and applies them as
 * global side effects: a root font-size scale, plus `data-reduce-motion` /
 * `data-contrast` attributes on <html> that the stylesheet honors. Also exposes
 * a `speak()` helper backed by the Web Speech API.
 */
export default function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<AccessibilityPrefs>(loadPrefs);

  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  // Persist + apply whenever prefs change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* storage may be unavailable (private mode); prefs still apply this session */
    }
    const root = document.documentElement;
    root.style.fontSize = `${prefs.textScale}%`;
    root.dataset.reduceMotion = prefs.reduceMotion ? "true" : "false";
    root.dataset.contrast = prefs.highContrast ? "high" : "normal";
  }, [prefs]);

  const set = useCallback((updates: Partial<AccessibilityPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...updates }));
  }, []);

  const stopSpeaking = useCallback(() => {
    if (speechSupported) window.speechSynthesis.cancel();
  }, [speechSupported]);

  const speak = useCallback(
    (text: string) => {
      if (!speechSupported || !text.trim()) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = prefs.ttsRate;
      window.speechSynthesis.speak(utterance);
    },
    [speechSupported, prefs.ttsRate],
  );

  const value = useMemo(
    () => ({ ...prefs, set, speak, stopSpeaking, speechSupported }),
    [prefs, set, speak, stopSpeaking, speechSupported],
  );

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}
