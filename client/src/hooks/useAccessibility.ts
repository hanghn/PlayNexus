import { useContext } from "react";
import {
  AccessibilityContext,
  type AccessibilityContextValue,
} from "../contexts/AccessibilityContext.ts";

/**
 * Access the app's accessibility preferences and helpers (TTS, reduce motion,
 * high contrast, text scale).
 * @throws if used outside an AccessibilityProvider
 */
export default function useAccessibility(): AccessibilityContextValue {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error("useAccessibility must be used within an AccessibilityProvider");
  return ctx;
}
