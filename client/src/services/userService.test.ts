// @vitest-environment jsdom
import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
const get = vi.fn();

vi.mock("./api.ts", () => ({
  api: {
    post: (...args: unknown[]) => post(...args),
    get: (...args: unknown[]) => get(...args),
  },
  apiErrorMessage: (err: unknown, fallback = "Something went wrong") => {
    if (err instanceof AxiosError) {
      const data = err.response?.data as { error?: unknown } | undefined;
      return typeof data?.error === "string" ? data.error : fallback;
    }
    if (err instanceof Error && err.message) return err.message;
    return fallback;
  },
}));

import {
  disableMfa,
  getMfaStatus,
  getSecurity,
  getSession,
  getUserById,
  loginUser,
  logoutUser,
  MfaRequiredError,
  revokeAllSessions,
  setRemember,
  signupUser,
  startMfaEnroll,
  updateUser,
  verifyLoginOtp,
  verifyMfaEnroll,
} from "./userService.ts";

const okUser = { id: "u1", username: "alice", email: "a@b.com" };

const makeAxiosError = (status?: number, data?: unknown) => {
  const err = new AxiosError("boom");
  if (status !== undefined) {
    err.response = { status, data } as AxiosError["response"];
  }
  return err;
};

beforeEach(() => {
  post.mockReset();
  get.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("loginUser", () => {
  it("returns user and accessToken on success", async () => {
    post.mockResolvedValue({ data: okUser });
    const result = await loginUser({ username: "alice", password: "pw" }, true);
    expect(result.user).toEqual(okUser);
    expect(result.accessToken).toBe("pw");
    expect(post).toHaveBeenCalledWith("/api/user/login", {
      username: "alice",
      password: "pw",
      remember: true,
    });
  });

  it("defaults remember to false", async () => {
    post.mockResolvedValue({ data: okUser });
    await loginUser({ username: "alice", password: "pw" });
    expect(post).toHaveBeenCalledWith("/api/user/login", {
      username: "alice",
      password: "pw",
      remember: false,
    });
  });

  it("throws MfaRequiredError when 2FA required", async () => {
    post.mockResolvedValue({ data: { mfaRequired: true, challengeId: "ch1" } });
    await expect(loginUser({ username: "a", password: "p" })).rejects.toBeInstanceOf(
      MfaRequiredError,
    );
    try {
      await loginUser({ username: "a", password: "p" });
    } catch (e) {
      expect((e as MfaRequiredError).challengeId).toBe("ch1");
      expect((e as MfaRequiredError).name).toBe("MfaRequiredError");
    }
  });

  it("throws on error body", async () => {
    post.mockResolvedValue({ data: { error: "bad creds" } });
    await expect(loginUser({ username: "a", password: "p" })).rejects.toThrow("bad creds");
  });
});

describe("verifyLoginOtp", () => {
  it("returns user on success", async () => {
    post.mockResolvedValue({ data: okUser });
    await expect(verifyLoginOtp("ch1", "123")).resolves.toEqual(okUser);
    expect(post).toHaveBeenCalledWith("/api/user/login/verify", {
      challengeId: "ch1",
      code: "123",
    });
  });
  it("throws on error body", async () => {
    post.mockResolvedValue({ data: { error: "nope" } });
    await expect(verifyLoginOtp("ch1", "123")).rejects.toThrow("nope");
  });
});

describe("mfa endpoints", () => {
  it("getMfaStatus success and error", async () => {
    get.mockResolvedValueOnce({ data: { enabled: true } });
    await expect(getMfaStatus()).resolves.toEqual({ enabled: true });
    get.mockResolvedValueOnce({ data: { error: "e" } });
    await expect(getMfaStatus()).rejects.toThrow("e");
  });

  it("startMfaEnroll success and error", async () => {
    post.mockResolvedValueOnce({ data: { challengeId: "c" } });
    await expect(startMfaEnroll("a@b.com")).resolves.toEqual({ challengeId: "c" });
    expect(post).toHaveBeenCalledWith("/api/user/mfa/enroll", { email: "a@b.com" });
    post.mockResolvedValueOnce({ data: { error: "e" } });
    await expect(startMfaEnroll("a@b.com")).rejects.toThrow("e");
  });

  it("verifyMfaEnroll success and error", async () => {
    post.mockResolvedValueOnce({ data: { enabled: true } });
    await expect(verifyMfaEnroll("c", "111")).resolves.toEqual({ enabled: true });
    expect(post).toHaveBeenCalledWith("/api/user/mfa/verify", { challengeId: "c", code: "111" });
    post.mockResolvedValueOnce({ data: { error: "e" } });
    await expect(verifyMfaEnroll("c", "111")).rejects.toThrow("e");
  });

  it("disableMfa success and error", async () => {
    post.mockResolvedValueOnce({ data: { enabled: false } });
    await expect(disableMfa()).resolves.toEqual({ enabled: false });
    expect(post).toHaveBeenCalledWith("/api/user/mfa/disable");
    post.mockResolvedValueOnce({ data: { error: "e" } });
    await expect(disableMfa()).rejects.toThrow("e");
  });
});

describe("security endpoints", () => {
  it("getSecurity success and error", async () => {
    get.mockResolvedValueOnce({ data: { mfa: false, remember: true } });
    await expect(getSecurity()).resolves.toEqual({ mfa: false, remember: true });
    get.mockResolvedValueOnce({ data: { error: "e" } });
    await expect(getSecurity()).rejects.toThrow("e");
  });

  it("setRemember success and error", async () => {
    post.mockResolvedValueOnce({ data: { remember: true } });
    await expect(setRemember(true)).resolves.toEqual({ remember: true });
    expect(post).toHaveBeenCalledWith("/api/user/security/remember", { remember: true });
    post.mockResolvedValueOnce({ data: { error: "e" } });
    await expect(setRemember(false)).rejects.toThrow("e");
  });

  it("revokeAllSessions resolves on success", async () => {
    post.mockResolvedValueOnce({ data: {} });
    await expect(revokeAllSessions()).resolves.toBeUndefined();
    expect(post).toHaveBeenCalledWith("/api/user/security/revoke-all");
  });

  it("revokeAllSessions wraps axios error message", async () => {
    post.mockRejectedValueOnce(makeAxiosError(500, { error: "server down" }));
    await expect(revokeAllSessions()).rejects.toThrow("server down");
  });

  it("revokeAllSessions uses fallback for non-axios error", async () => {
    post.mockRejectedValueOnce(new Error(""));
    await expect(revokeAllSessions()).rejects.toThrow("Could not sign out of all devices");
  });
});

describe("getSession", () => {
  it("returns user when body has no error", async () => {
    get.mockResolvedValueOnce({ data: okUser });
    await expect(getSession()).resolves.toEqual(okUser);
  });

  it("returns null when body has error", async () => {
    get.mockResolvedValueOnce({ data: { error: "no session" } });
    await expect(getSession()).resolves.toBeNull();
  });

  it("returns null on axios error with response (401)", async () => {
    get.mockRejectedValueOnce(makeAxiosError(401, { error: "unauth" }));
    await expect(getSession()).resolves.toBeNull();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("retries once on a network error then succeeds", async () => {
    vi.useFakeTimers();
    get.mockRejectedValueOnce(makeAxiosError()).mockResolvedValueOnce({ data: okUser });
    const promise = getSession();
    await vi.advanceTimersByTimeAsync(400);
    await expect(promise).resolves.toEqual(okUser);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("returns null after both attempts fail with network errors", async () => {
    vi.useFakeTimers();
    get.mockRejectedValue(makeAxiosError());
    const promise = getSession();
    await vi.advanceTimersByTimeAsync(400);
    await expect(promise).resolves.toBeNull();
    expect(get).toHaveBeenCalledTimes(2);
  });
});

describe("logoutUser", () => {
  it("posts to logout", async () => {
    post.mockResolvedValueOnce({ data: {} });
    await expect(logoutUser()).resolves.toBeUndefined();
    expect(post).toHaveBeenCalledWith("/api/user/logout");
  });
});

describe("signupUser", () => {
  it("returns user and accessToken", async () => {
    post.mockResolvedValueOnce({ data: okUser });
    const result = await signupUser({ username: "alice", password: "pw" });
    expect(result.user).toEqual(okUser);
    expect(result.accessToken).toBe("pw");
    expect(post).toHaveBeenCalledWith("/api/user/signup", { username: "alice", password: "pw" });
  });

  it("throws on error body", async () => {
    post.mockResolvedValueOnce({ data: { error: "taken" } });
    await expect(signupUser({ username: "a", password: "p" })).rejects.toThrow("taken");
  });
});

describe("updateUser", () => {
  it("posts auth + payload and returns user", async () => {
    post.mockResolvedValueOnce({ data: okUser });
    const auth = { username: "alice", password: "pw" } as never;
    const updates = { email: "new@b.com" } as never;
    await expect(updateUser(auth, updates)).resolves.toEqual(okUser);
    expect(post).toHaveBeenCalledWith("/api/user/alice", { auth, payload: updates });
  });

  it("throws on error body", async () => {
    post.mockResolvedValueOnce({ data: { error: "fail" } });
    await expect(updateUser({ username: "a", password: "p" }, {})).rejects.toThrow("fail");
  });
});

describe("getUserById", () => {
  it("returns user", async () => {
    get.mockResolvedValueOnce({ data: okUser });
    await expect(getUserById("alice")).resolves.toEqual(okUser);
    expect(get).toHaveBeenCalledWith("/api/user/alice");
  });

  it("throws on error body", async () => {
    get.mockResolvedValueOnce({ data: { error: "not found" } });
    await expect(getUserById("ghost")).rejects.toThrow("not found");
  });
});
