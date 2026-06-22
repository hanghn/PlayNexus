// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import Login from "./Login.tsx";
import type { AuthContext } from "../contexts/LoginContext.ts";

// ---- Mocks for IO/external deps ----
const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

const loginUser = vi.fn();
const signupUser = vi.fn();
const verifyLoginOtp = vi.fn();
const logoutUser = vi.fn();

vi.mock("../services/userService.ts", () => {
  // MfaRequiredError must be a real class so `instanceof` works in the hook.
  // Defined inside the (hoisted) factory to avoid the temporal-dead-zone error.
  class MfaRequiredError extends Error {
    challengeId: string;
    constructor(challengeId: string) {
      super("mfa required");
      this.name = "MfaRequiredError";
      this.challengeId = challengeId;
    }
  }
  return {
    MfaRequiredError,
    loginUser: (...a: unknown[]) => loginUser(...a),
    signupUser: (...a: unknown[]) => signupUser(...a),
    verifyLoginOtp: (...a: unknown[]) => verifyLoginOtp(...a),
    logoutUser: (...a: unknown[]) => logoutUser(...a),
  };
});

// Pull the mocked class back so tests can construct instances of it.
import { MfaRequiredError } from "../services/userService.ts";

const saveAuthToken = vi.fn();
const clearAuthToken = vi.fn();
vi.mock("../lib/authStorage.ts", () => ({
  saveAuthToken: (...a: unknown[]) => saveAuthToken(...a),
  clearAuthToken: (...a: unknown[]) => clearAuthToken(...a),
}));

const user: AuthContext["user"] = { username: "alice" } as AuthContext["user"];

function renderLogin() {
  const setAuth = vi.fn();
  render(
    <MemoryRouter>
      <Login setAuth={setAuth} />
    </MemoryRouter>,
  );
  return { setAuth };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("Login", () => {
  it("renders the login form by default", () => {
    renderLogin();
    expect(screen.getByText("Log into PlayNexus")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log In" })).toBeInTheDocument();
    expect(screen.getByText("Remember me on this device")).toBeInTheDocument();
  });

  it("toggles password visibility via the eye button", () => {
    renderLogin();
    const pw = screen.getByLabelText("Password");
    expect((pw as HTMLInputElement).type).toBe("password");
    const eye = screen.getByRole("button", { name: "Show password" });
    fireEvent.click(eye);
    expect((screen.getByLabelText("Password") as HTMLInputElement).type).toBe("text");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect((screen.getByLabelText("Password") as HTMLInputElement).type).toBe("password");
  });

  it("toggles the remember-me checkbox", () => {
    renderLogin();
    const cb = screen.getByLabelText("Remember me on this device") as HTMLInputElement;
    expect(cb.checked).toBe(false);
    fireEvent.click(cb);
    expect(cb.checked).toBe(true);
  });

  it("shows validation error when fields are empty", async () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));
    expect(await screen.findByText("Please enter a username and password")).toBeInTheDocument();
    expect(loginUser).not.toHaveBeenCalled();
  });

  it("switches to signup mode and shows confirm password", () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    expect(screen.getByLabelText("Confirm Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign Up" })).toBeInTheDocument();
    // remember-me only shows in login mode
    expect(screen.queryByLabelText("Remember me on this device")).not.toBeInTheDocument();
  });

  it("shows error when signup passwords do not match", async () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "pw1" } });
    fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: "pw2" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));
    expect(await screen.findByText("Passwords don't match")).toBeInTheDocument();
    expect(signupUser).not.toHaveBeenCalled();
  });

  it("logs in successfully and navigates home", async () => {
    loginUser.mockResolvedValue({ user, accessToken: "tok" });
    const { setAuth } = renderLogin();
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByLabelText("Remember me on this device"));
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));

    await waitFor(() =>
      expect(loginUser).toHaveBeenCalledWith({ username: "alice", password: "secret" }, true),
    );
    expect(saveAuthToken).toHaveBeenCalledWith("alice", "tok");
    expect(setAuth).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith("/");
  });

  it("signs up successfully using typed password when no token issued", async () => {
    signupUser.mockResolvedValue({ user, accessToken: "" });
    const { setAuth } = renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    await waitFor(() =>
      expect(signupUser).toHaveBeenCalledWith({ username: "alice", password: "secret" }),
    );
    expect(saveAuthToken).toHaveBeenCalledWith("alice", "secret");
    expect(setAuth).toHaveBeenCalled();
  });

  it("surfaces a login error message", async () => {
    loginUser.mockRejectedValue(new Error("bad creds"));
    renderLogin();
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));
    expect(await screen.findByText("Error: bad creds")).toBeInTheDocument();
  });

  it("enters the 2FA step on MfaRequiredError and verifies the code", async () => {
    loginUser.mockRejectedValue(new MfaRequiredError("chal-1"));
    verifyLoginOtp.mockResolvedValue(user);
    const { setAuth } = renderLogin();
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));

    expect(await screen.findByText("Enter your code")).toBeInTheDocument();
    const codeInput = screen.getByLabelText("6-digit code");
    fireEvent.change(codeInput, { target: { value: " 123456 " } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => expect(verifyLoginOtp).toHaveBeenCalledWith("chal-1", "123456"));
    expect(setAuth).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith("/");
  });

  it("shows an error when OTP verification fails", async () => {
    loginUser.mockRejectedValue(new MfaRequiredError("chal-1"));
    verifyLoginOtp.mockRejectedValue(new Error("wrong code"));
    renderLogin();
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));

    fireEvent.change(await screen.findByLabelText("6-digit code"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(await screen.findByText("Error: wrong code")).toBeInTheDocument();
  });

  it("cancels the 2FA step via the Back button", async () => {
    loginUser.mockRejectedValue(new MfaRequiredError("chal-1"));
    renderLogin();
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));

    expect(await screen.findByText("Enter your code")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByText("Log into PlayNexus")).toBeInTheDocument();
  });
});
