import useLoginForm from "../hooks/useLoginForm.ts";
import "./Login.css";
import { useState } from "react";
import type { AuthContext } from "../contexts/LoginContext.ts";
import badgeLogo from "../assets/playnexus-badge.png";

interface LoginProps {
  setAuth: (s: AuthContext | null) => void;
}

/**
 * Renders a login form with username and password inputs, password visibility toggle,
 * and error handling.
 */
export default function Login({ setAuth }: LoginProps) {
  const {
    mode,
    username,
    password,
    confirm,
    err,
    remember,
    setRemember,
    handleInputChange,
    handleSubmit,
    toggleMode,
    awaitingOtp,
    otpCode,
    setOtpCode,
    handleVerifyOtp,
    cancelMfa,
  } = useLoginForm(setAuth);
  const [showPassword, setShowPassword] = useState(false);

  // 2FA step: password was accepted and a code was emailed; collect it here.
  if (awaitingOtp) {
    return (
      <main className="container">
        <img src={badgeLogo} alt="PlayNexus" className="login-badge" />
        <form className="login" onSubmit={(e) => handleVerifyOtp(e)}>
          <h1>Enter your code</h1>
          <p className="centered" style={{ fontSize: "0.85rem", color: "#000000" }}>
            We emailed a 6-digit code to the address on your account. It expires in 10 minutes.
          </p>
          <input
            type="text"
            inputMode="numeric"
            value={otpCode}
            onChange={(event) => setOtpCode(event.target.value)}
            placeholder="6-digit code"
            aria-label="6-digit code"
            className="widefill"
            autoFocus
          />
          {err && <p className="error-message centered">{err}</p>}
          <button type="submit" className="widefill primary">
            Verify
          </button>
          <button
            className="narrowcenter secondary"
            onClick={(e) => {
              e.preventDefault();
              cancelMfa();
            }}
          >
            Back
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="container">
      <img src={badgeLogo} alt="PlayNexus" className="login-badge" />
      <form className="login" onSubmit={(e) => handleSubmit(e)}>
        <h1>Log into PlayNexus</h1>
        <input
          type="text"
          value={username}
          onChange={(event) => handleInputChange(event, "username")}
          placeholder="Username"
          aria-label="Username"
          className="widefill"
        />
        <div className="login-field">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => handleInputChange(event, "password")}
            placeholder="Password"
            aria-label="Password"
            className="widefill login-field-input"
          />
          <button
            type="button"
            className="login-eye"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            title={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((prev) => !prev)}
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </button>
        </div>
        {mode === "signup" && (
          <input
            type={showPassword ? "text" : "password"}
            value={confirm}
            onChange={(event) => handleInputChange(event, "confirm")}
            placeholder="Confirm Password"
            aria-label="Confirm Password"
            className="widefill"
          />
        )}
        {mode === "login" && (
          <div className="labeled-section">
            <input
              type="checkbox"
              id="rememberMeToggle"
              checked={remember}
              onChange={() => setRemember((prev) => !prev)}
            />
            <label htmlFor="rememberMeToggle">Remember me on this device</label>
          </div>
        )}
        {err && <p className="error-message centered">{err}</p>}
        <button type="submit" className="widefill primary">
          {mode === "signup" ? "Sign Up" : "Log In"}
        </button>
        <div className="login-or">
          <span className="login-or-line" />
          <span className="login-or-text">or</span>
          <span className="login-or-line" />
        </div>
        <p className="login-switch">
          {mode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            className="login-switch-link"
            onClick={(e) => {
              e.preventDefault();
              toggleMode();
            }}
          >
            {mode === "signup" ? "Log in" : "Sign up"}
          </button>
        </p>
      </form>
    </main>
  );
}

/** Eye icon (password hidden → click to show). */
function Eye() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** Eye-off icon (password shown → click to hide). */
function EyeOff() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7c2 0 3.8.66 5.3 1.6M22 12s-3.5 7-10 7c-2 0-3.8-.66-5.3-1.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m4 4 16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
