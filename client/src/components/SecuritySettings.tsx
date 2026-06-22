import useSecuritySettings from "../hooks/useSecuritySettings.ts";

/**
 * Profile security settings: enable/disable email 2FA and control whether the
 * session cookie persists across browser restarts ("remember me"), plus a
 * sign-out-of-all-devices action. Rendered inside the profile form, so every
 * control is a `type="button"` to avoid submitting that form.
 */
export default function SecuritySettings() {
  const {
    status,
    error,
    busy,
    stage,
    email,
    setEmail,
    code,
    setCode,
    sendEnrollCode,
    confirmEnroll,
    cancelEnroll,
    disable2FA,
    toggleRemember,
    signOutEverywhere,
  } = useSecuritySettings();

  if (!status) {
    return (
      <div className="spacedSection">
        <h3>Security</h3>
        <div className="smallAndGray">Loading…</div>
      </div>
    );
  }

  return (
    <div className="spacedSection">
      <h3>Security</h3>

      {/* --- Two-factor authentication (email) --- */}
      <div className="spacedSection">
        <strong>Two-factor authentication (email)</strong>
        {status.mfaEnabled ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span className="smallAndGray">Enabled — codes are sent to {status.email}</span>
            <button type="button" className="secondary narrow" disabled={busy} onClick={disable2FA}>
              Disable
            </button>
          </div>
        ) : stage === "idle" ? (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <input
              type="email"
              className="widefill notTooWide"
              placeholder="Email for login codes"
              aria-label="Email for login codes"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="button"
              className="secondary narrow"
              disabled={busy || email.trim() === ""}
              onClick={sendEnrollCode}
            >
              Send code
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <span className="smallAndGray" style={{ width: "100%" }}>
              Enter the code sent to {email}
            </span>
            <input
              type="text"
              inputMode="numeric"
              className="widefill notTooWide"
              placeholder="6-digit code"
              aria-label="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button
              type="button"
              className="primary narrow"
              disabled={busy || code.trim() === ""}
              onClick={confirmEnroll}
            >
              Verify &amp; enable
            </button>
            <button
              type="button"
              className="secondary narrow"
              disabled={busy}
              onClick={cancelEnroll}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* --- Cookies / persistent session --- */}
      <div className="spacedSection">
        <strong>Cookies</strong>
        <div className="labeled-section">
          <input
            type="checkbox"
            id="rememberMeToggle"
            checked={status.rememberMe}
            disabled={busy}
            onChange={(e) => toggleRemember(e.target.checked)}
          />
          <label htmlFor="rememberMeToggle">Stay signed in on this device</label>
        </div>
        <div className="smallAndGray">
          When on, your login is remembered after you close the browser; when off, you stay signed
          in only until the browser closes.
        </div>
        <button
          type="button"
          className="secondary narrow"
          style={{ marginTop: "0.5rem" }}
          disabled={busy}
          onClick={signOutEverywhere}
        >
          Sign out of all devices
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}
    </div>
  );
}
