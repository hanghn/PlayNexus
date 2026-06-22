import { type ChangeEvent, type FormEvent, useState } from "react";
import {
  loginUser,
  logoutUser,
  MfaRequiredError,
  signupUser,
  verifyLoginOtp,
} from "../services/userService.ts";
import type { AuthContext } from "../contexts/LoginContext.ts";
import { useNavigate } from "react-router-dom";
import { saveAuthToken, clearAuthToken } from "../lib/authStorage.ts";

/**
 * Custom hook to manage login page logic.
 * @param setAuth - A callback for saving the database user
 * @returns An object containing:
 *   - mode: Either `'login'` or `'signup'`
 *   - toggleMode: Callback that toggles the mode
 *   - username: The current value of the username input
 *   - password: The current value of the password input.
 *   - confirm: The current value of the password confirmation input.
 *   - err: The current error message, if any.
 *   - handleInputChange: Function to handle changes in input fields.
 *   - handleSubmit: Function to handle form submission.
 */
export default function useLoginForm(setAuth: (auth: AuthContext | null) => void) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirm, setConfirm] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  // Persistent ("remember me") login. When true the session cookie survives
  // closing the browser.
  const [remember, setRemember] = useState<boolean>(false);
  // When 2FA is enabled, login returns a challenge id and we switch to the
  // code-entry step instead of logging in immediately.
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState<string>("");
  const navigate = useNavigate();

  /** Save the authenticated user and go to the home page. */
  const finishLogin = (user: AuthContext["user"], pass: string) => {
    // Persist the token per-tab so it survives reloads and stays authoritative
    // over the (shared) session cookie.
    saveAuthToken(user.username, pass);
    setAuth({
      user,
      pass,
      reset: () => {
        void logoutUser();
        clearAuthToken();
        setAuth(null);
      },
    });
    return navigate("/");
  };

  /**
   * Validates the input fields for the form.
   * Ensures required fields are filled and passwords match (for signup).
   *
   * @returns {boolean} True if inputs are valid, false otherwise.
   */
  const validateInputs = (): boolean => {
    if (username.trim() === "" || password.trim() === "") {
      setErr("Please enter a username and password");
      return false;
    }

    if (mode === "signup" && confirm !== password) {
      setErr("Passwords don't match");
      return false;
    }

    return true;
  };

  /**
   * Handles changes in input fields and updates the corresponding state.
   *
   * @param e - The input change event.
   * @param field - The field being updated ('username', 'password', or 'confirm').
   */
  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement>,
    field: "username" | "password" | "confirm",
  ) => {
    if (field === "username") {
      setUsername(e.target.value);
    } else if (field === "password") {
      setPassword(e.target.value);
    } else {
      setConfirm(e.target.value);
    }
  };

  /**
   * Handles the submission of the form.
   * Validates input, performs login/signup, and navigates to the home page on
   * success.
   *
   * @param event - The form submission event.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateInputs()) {
      return;
    }

    try {
      if (mode === "signup") {
        const result = await signupUser({ username, password });
        // Fall back to the typed password when no Supabase token is issued, so
        // the per-tab credential still uniquely identifies this user (and stays
        // authoritative over a shared session cookie from another account).
        await finishLogin(result.user, result.accessToken || password);
      } else {
        const result = await loginUser({ username, password }, remember);
        await finishLogin(result.user, result.accessToken || password);
      }
    } catch (err) {
      // 2FA is on: password was accepted and a code was emailed. Switch to the
      // code-entry step rather than surfacing this as an error.
      if (err instanceof MfaRequiredError) {
        setMfaChallengeId(err.challengeId);
        setErr(null);
        return;
      }
      setErr(`${err}`);
    }
  };

  /** Submit the emailed 2FA code to complete a login. */
  const handleVerifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mfaChallengeId) return;
    try {
      const user = await verifyLoginOtp(mfaChallengeId, otpCode.trim());
      await finishLogin(user, password);
    } catch (err) {
      setErr(`${err}`);
    }
  };

  /** Abandon the 2FA step and return to the username/password form. */
  const cancelMfa = () => {
    setMfaChallengeId(null);
    setOtpCode("");
    setErr(null);
  };

  return {
    mode,
    toggleMode: () => setMode((m) => (m === "login" ? "signup" : "login")),
    username,
    password,
    confirm,
    err,
    remember,
    setRemember,
    handleInputChange,
    handleSubmit,
    // 2FA code step
    awaitingOtp: mfaChallengeId !== null,
    otpCode,
    setOtpCode,
    handleVerifyOtp,
    cancelMfa,
  };
}
