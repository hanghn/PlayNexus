import useAccessibility from "../hooks/useAccessibility.ts";
import "./AccessibilitySettings.css";

/** A labeled on/off switch (keyboard-operable, screen-reader friendly). */
function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="a11y-row">
      <div className="a11y-row-text">
        <span className="a11y-row-label">{label}</span>
        <span className="a11y-row-desc">{description}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`a11y-switch${checked ? " is-on" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className="a11y-knob" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Discord-style "Audio & Screen Reader" panel. Every control here actually
 * changes the app: TTS rate drives the "Speak" buttons on messages; reduce
 * motion, high contrast, and text size apply globally via the provider.
 */
export default function AccessibilitySettings() {
  const {
    ttsRate,
    reduceMotion,
    highContrast,
    textScale,
    set,
    speak,
    stopSpeaking,
    speechSupported,
  } = useAccessibility();

  return (
    <div className="a11y">
      <h3 className="a11y-title">Audio &amp; Screen Reader</h3>

      {/* Text-to-Speech rate */}
      <div className="a11y-block">
        <label className="a11y-row-label" htmlFor="ttsRate">
          Text-to-Speech rate
        </label>
        <p className="a11y-row-desc">
          Controls how fast text is read aloud when you use “Speak message”.
        </p>
        <div className="a11y-slider-head">
          <span>Slower</span>
          <span className="a11y-value">x{ttsRate.toFixed(1)}</span>
          <span>Faster</span>
        </div>
        <input
          id="ttsRate"
          type="range"
          min={0.5}
          max={2}
          step={0.1}
          value={ttsRate}
          disabled={!speechSupported}
          onChange={(e) => set({ ttsRate: Number(e.target.value) })}
          aria-valuetext={`${ttsRate.toFixed(1)} times speed`}
        />
        <div className="a11y-actions">
          <button
            type="button"
            className="accentBtn accentBtn--blue"
            disabled={!speechSupported}
            onClick={() => speak("This is a preview of the text to speech rate.")}
          >
            ▶ Preview
          </button>
          <button type="button" className="accentBtn accentBtn--red" onClick={stopSpeaking}>
            Stop
          </button>
        </div>
        {!speechSupported && (
          <p className="a11y-row-desc">Your browser doesn’t support speech synthesis.</p>
        )}
      </div>

      {/* Text size */}
      <div className="a11y-block">
        <label className="a11y-row-label" htmlFor="textScale">
          Text size
        </label>
        <p className="a11y-row-desc">Scales text across the whole app for easier reading.</p>
        <div className="a11y-slider-head">
          <span>Smaller</span>
          <span className="a11y-value">{textScale}%</span>
          <span>Larger</span>
        </div>
        <input
          id="textScale"
          type="range"
          min={90}
          max={150}
          step={5}
          value={textScale}
          onChange={(e) => set({ textScale: Number(e.target.value) })}
          aria-valuetext={`${textScale} percent`}
        />
      </div>

      {/* Toggles */}
      <Toggle
        label="Reduce motion"
        description="Minimizes animations and transitions across the app."
        checked={reduceMotion}
        onChange={(v) => set({ reduceMotion: v })}
      />
      <Toggle
        label="High contrast"
        description="Increases text and border contrast and underlines links."
        checked={highContrast}
        onChange={(v) => set({ highContrast: v })}
      />
    </div>
  );
}
