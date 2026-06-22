import { createContext } from "react";

/**
 * User accessibility preferences. These are device-level UI settings, so they
 * persist in localStorage rather than on the account.
 */
export interface AccessibilityPrefs {
  /** Speech-synthesis rate for "Speak message" / previews (0.5–2.0). */
  ttsRate: number;
  /** Disable non-essential animations/transitions site-wide. */
  reduceMotion: boolean;
  /** Boost text/border contrast. */
  highContrast: boolean;
  /** Root font-size scale, as a percentage (90–150). */
  textScale: number;
}

export const defaultPrefs: AccessibilityPrefs = {
  ttsRate: 1,
  reduceMotion: false,
  highContrast: false,
  textScale: 100,
};

export interface AccessibilityContextValue extends AccessibilityPrefs {
  /** Update one or more preferences. */
  set: (updates: Partial<AccessibilityPrefs>) => void;
  /** Read `text` aloud at the current TTS rate (no-op if unsupported). */
  speak: (text: string) => void;
  /** Stop any in-progress speech. */
  stopSpeaking: () => void;
  /** Whether the browser supports speech synthesis. */
  speechSupported: boolean;
}

export const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);
