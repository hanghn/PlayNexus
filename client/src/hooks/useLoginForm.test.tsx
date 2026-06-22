// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

// --- Mocks --------------------------------------------------------------

const navigateMock = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

const loginUser = vi.fn();
const signupUser = vi.fn();
const logoutUser = vi.fn();
const verifyLoginOtp = vi.fn();

vi.mock("../services/userService.ts", () => {
  // Defined inside the (hoisted) factory so `instanceof` checks work and there
  // are no top-level captured variables.
  class MfaRequiredError extends Error {
    readonly challengeId: string;
    constructor(challengeId: string) {
      super("Two-factor authentication required");
      this.name = "MfaRequiredError";
      this.challengeId = challengeId;
    }
  }
  return {
    loginUser: (...args: unknown[]) => loginUser(...args),
    signupUser: (...args: unknown[]) => signupUser(...args),
    logoutUser: (...args: unknown[]) => logoutUser(...args),
    verifyLoginOtp: (...args: unknown[]) => verifyLoginOtp(...args),
    MfaRequiredError,
  };
});

const saveAuthToken = vi.fn();
const clearAuthToken = vi.fn();
vi.mock("../lib/authStorage.ts", () => ({
  saveAuthToken: (...args: unknown[]) => saveAuthToken(...args),
  clearAuthToken: (...args: unknown[]) => clearAuthToken(...args),
}));

import useLoginForm from "./useLoginForm.ts";
import { MfaRequiredError } from "../services/userService.ts";

// --- Helpers ------------------------------------------------------------

const makeUser = (username = "alice") => ({ username }) as never;

function changeEvent(value: string) {
  return { target: { value } } as React.ChangeEvent<HTMLInputElement>;
}

function submitEvent() {
  return { preventDefault: vi.fn() } as unknown as React.FormEvent<HTMLFormElement>;
}

describe("useLoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with login mode and empty fields", () => {
    const setAuth = vi.fn();
    const { result } = renderHook(() => useLoginForm(setAuth));

    expect(result.current.mode).toBe("login");
    expect(result.current.username).toBe("");
    expect(result.current.password).toBe("");
    expect(result.current.confirm).toBe("");
    expect(result.current.err).toBeNull();
    expect(result.current.remember).toBe(false);
    expect(result.current.awaitingOtp).toBe(false);
    expect(result.current.otpCode).toBe("");
  });

  it("toggleMode switches between login and signup", () => {
    const { result } = renderHook(() => useLoginForm(vi.fn()));

    act(() => result.current.toggleMode());
    expect(result.current.mode).toBe("signup");
    act(() => result.current.toggleMode());
    expect(result.current.mode).toBe("login");
  });

  it("handleInputChange updates username, password and confirm", () => {
    const { result } = renderHook(() => useLoginForm(vi.fn()));

    act(() => result.current.handleInputChange(changeEvent("bob"), "username"));
    act(() => result.current.handleInputChange(changeEvent("pw"), "password"));
    act(() => result.current.handleInputChange(changeEvent("pw2"), "confirm"));

    expect(result.current.username).toBe("bob");
    expect(result.current.password).toBe("pw");
    expect(result.current.confirm).toBe("pw2");
  });

  it("setRemember and setOtpCode update their state", () => {
    const { result } = renderHook(() => useLoginForm(vi.fn()));

    act(() => result.current.setRemember(true));
    expect(result.current.remember).toBe(true);

    act(() => result.current.setOtpCode("123456"));
    expect(result.current.otpCode).toBe("123456");
  });

  it("rejects submit when fields are empty (validateInputs)", async () => {
    const { result } = renderHook(() => useLoginForm(vi.fn()));

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(result.current.err).toBe("Please enter a username and password");
    expect(loginUser).not.toHaveBeenCalled();
  });

  it("rejects signup when passwords do not match", async () => {
    const { result } = renderHook(() => useLoginForm(vi.fn()));

    act(() => result.current.toggleMode());
    act(() => result.current.handleInputChange(changeEvent("bob"), "username"));
    act(() => result.current.handleInputChange(changeEvent("pw"), "password"));
    act(() => result.current.handleInputChange(changeEvent("different"), "confirm"));

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(result.current.err).toBe("Passwords don't match");
    expect(signupUser).not.toHaveBeenCalled();
  });

  it("logs in successfully and finishes login (saves token, sets auth, navigates)", async () => {
    loginUser.mockResolvedValue({ user: makeUser("alice"), accessToken: "token-1" });
    const setAuth = vi.fn();
    const { result } = renderHook(() => useLoginForm(setAuth));

    act(() => result.current.handleInputChange(changeEvent("alice"), "username"));
    act(() => result.current.handleInputChange(changeEvent("secret"), "password"));
    act(() => result.current.setRemember(true));

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(loginUser).toHaveBeenCalledWith({ username: "alice", password: "secret" }, true);
    expect(saveAuthToken).toHaveBeenCalledWith("alice", "token-1");
    expect(setAuth).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith("/");
    expect(result.current.err).toBeNull();
  });

  it("falls back to typed password when no accessToken returned", async () => {
    loginUser.mockResolvedValue({ user: makeUser("alice"), accessToken: "" });
    const { result } = renderHook(() => useLoginForm(vi.fn()));

    act(() => result.current.handleInputChange(changeEvent("alice"), "username"));
    act(() => result.current.handleInputChange(changeEvent("typedpw"), "password"));

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(saveAuthToken).toHaveBeenCalledWith("alice", "typedpw");
  });

  it("auth.reset logs out, clears token and clears auth", async () => {
    loginUser.mockResolvedValue({ user: makeUser("alice"), accessToken: "token-1" });
    logoutUser.mockResolvedValue(undefined);
    const setAuth = vi.fn();
    const { result } = renderHook(() => useLoginForm(setAuth));

    act(() => result.current.handleInputChange(changeEvent("alice"), "username"));
    act(() => result.current.handleInputChange(changeEvent("secret"), "password"));
    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    const authArg = setAuth.mock.calls[0][0];
    act(() => authArg.reset());

    expect(logoutUser).toHaveBeenCalled();
    expect(clearAuthToken).toHaveBeenCalled();
    expect(setAuth).toHaveBeenLastCalledWith(null);
  });

  it("signs up successfully", async () => {
    signupUser.mockResolvedValue({ user: makeUser("newbie"), accessToken: "stoken" });
    const setAuth = vi.fn();
    const { result } = renderHook(() => useLoginForm(setAuth));

    act(() => result.current.toggleMode());
    act(() => result.current.handleInputChange(changeEvent("newbie"), "username"));
    act(() => result.current.handleInputChange(changeEvent("pw"), "password"));
    act(() => result.current.handleInputChange(changeEvent("pw"), "confirm"));

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(signupUser).toHaveBeenCalledWith({ username: "newbie", password: "pw" });
    expect(saveAuthToken).toHaveBeenCalledWith("newbie", "stoken");
    expect(setAuth).toHaveBeenCalledTimes(1);
  });

  it("surfaces a generic error from login as a string", async () => {
    loginUser.mockRejectedValue(new Error("bad credentials"));
    const { result } = renderHook(() => useLoginForm(vi.fn()));

    act(() => result.current.handleInputChange(changeEvent("alice"), "username"));
    act(() => result.current.handleInputChange(changeEvent("secret"), "password"));

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(result.current.err).toBe("Error: bad credentials");
    expect(result.current.awaitingOtp).toBe(false);
  });

  it("enters the OTP step when login throws MfaRequiredError", async () => {
    loginUser.mockRejectedValue(new MfaRequiredError("chal-123"));
    const { result } = renderHook(() => useLoginForm(vi.fn()));

    act(() => result.current.handleInputChange(changeEvent("alice"), "username"));
    act(() => result.current.handleInputChange(changeEvent("secret"), "password"));

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(result.current.awaitingOtp).toBe(true);
    expect(result.current.err).toBeNull();
  });

  it("handleVerifyOtp does nothing when not awaiting OTP", async () => {
    const { result } = renderHook(() => useLoginForm(vi.fn()));

    await act(async () => {
      await result.current.handleVerifyOtp(submitEvent());
    });

    expect(verifyLoginOtp).not.toHaveBeenCalled();
  });

  it("verifies OTP and finishes login", async () => {
    loginUser.mockRejectedValue(new MfaRequiredError("chal-123"));
    verifyLoginOtp.mockResolvedValue(makeUser("alice"));
    const setAuth = vi.fn();
    const { result } = renderHook(() => useLoginForm(setAuth));

    act(() => result.current.handleInputChange(changeEvent("alice"), "username"));
    act(() => result.current.handleInputChange(changeEvent("secret"), "password"));
    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    act(() => result.current.setOtpCode("  654321  "));
    await act(async () => {
      await result.current.handleVerifyOtp(submitEvent());
    });

    expect(verifyLoginOtp).toHaveBeenCalledWith("chal-123", "654321");
    expect(saveAuthToken).toHaveBeenCalledWith("alice", "secret");
    expect(setAuth).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith("/");
  });

  it("surfaces an OTP verification error", async () => {
    loginUser.mockRejectedValue(new MfaRequiredError("chal-123"));
    verifyLoginOtp.mockRejectedValue(new Error("wrong code"));
    const { result } = renderHook(() => useLoginForm(vi.fn()));

    act(() => result.current.handleInputChange(changeEvent("alice"), "username"));
    act(() => result.current.handleInputChange(changeEvent("secret"), "password"));
    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    act(() => result.current.setOtpCode("000000"));
    await act(async () => {
      await result.current.handleVerifyOtp(submitEvent());
    });

    expect(result.current.err).toBe("Error: wrong code");
  });

  it("cancelMfa resets the OTP step", async () => {
    loginUser.mockRejectedValue(new MfaRequiredError("chal-123"));
    const { result } = renderHook(() => useLoginForm(vi.fn()));

    act(() => result.current.handleInputChange(changeEvent("alice"), "username"));
    act(() => result.current.handleInputChange(changeEvent("secret"), "password"));
    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });
    expect(result.current.awaitingOtp).toBe(true);

    act(() => result.current.setOtpCode("123"));
    act(() => result.current.cancelMfa());

    expect(result.current.awaitingOtp).toBe(false);
    expect(result.current.otpCode).toBe("");
    expect(result.current.err).toBeNull();
  });
});
