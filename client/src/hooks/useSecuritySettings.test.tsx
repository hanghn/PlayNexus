// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import useSecuritySettings from "./useSecuritySettings.ts";

const mockReset = vi.fn();

vi.mock("./useLoginContext.ts", () => ({
  default: () => ({ reset: mockReset }),
}));

vi.mock("../services/api.ts", () => ({
  api: {},
  apiErrorMessage: (err: unknown, fallback = "Something went wrong") =>
    err instanceof Error && err.message ? err.message : fallback,
}));

vi.mock("../services/userService.ts", () => ({
  getSecurity: vi.fn(),
  startMfaEnroll: vi.fn(),
  verifyMfaEnroll: vi.fn(),
  disableMfa: vi.fn(),
  setRemember: vi.fn(),
  revokeAllSessions: vi.fn(),
}));

import {
  disableMfa,
  getSecurity,
  revokeAllSessions,
  setRemember,
  startMfaEnroll,
  verifyMfaEnroll,
} from "../services/userService.ts";

const getSecurityMock = vi.mocked(getSecurity);
const startMfaEnrollMock = vi.mocked(startMfaEnroll);
const verifyMfaEnrollMock = vi.mocked(verifyMfaEnroll);
const disableMfaMock = vi.mocked(disableMfa);
const setRememberMock = vi.mocked(setRemember);
const revokeAllSessionsMock = vi.mocked(revokeAllSessions);

const baseStatus = { mfaEnabled: false, remember: false } as never;
const enabledStatus = { mfaEnabled: true, remember: false } as never;

describe("useSecuritySettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSecurityMock.mockResolvedValue(baseStatus);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads the security status on mount", async () => {
    const { result } = renderHook(() => useSecuritySettings());
    await waitFor(() => expect(result.current.status).toEqual(baseStatus));
    expect(getSecurityMock).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.busy).toBe(false);
    expect(result.current.stage).toBe("idle");
  });

  it("records an error when the initial load fails", async () => {
    getSecurityMock.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useSecuritySettings());
    await waitFor(() => expect(result.current.error).toBe("boom"));
    expect(result.current.status).toBeNull();
  });

  it("sets email/code via setters", async () => {
    const { result } = renderHook(() => useSecuritySettings());
    await waitFor(() => expect(result.current.status).toEqual(baseStatus));
    act(() => result.current.setEmail("a@b.com"));
    act(() => result.current.setCode("123456"));
    expect(result.current.email).toBe("a@b.com");
    expect(result.current.code).toBe("123456");
  });

  it("sends an enroll code and advances to codeSent", async () => {
    startMfaEnrollMock.mockResolvedValue({ challengeId: "ch-1" });
    const { result } = renderHook(() => useSecuritySettings());
    await waitFor(() => expect(result.current.status).toEqual(baseStatus));

    act(() => result.current.setEmail("  user@test.com  "));
    await act(async () => {
      await result.current.sendEnrollCode();
    });

    expect(startMfaEnrollMock).toHaveBeenCalledWith("user@test.com");
    expect(result.current.stage).toBe("codeSent");
    expect(result.current.busy).toBe(false);
  });

  it("surfaces an error from sendEnrollCode", async () => {
    startMfaEnrollMock.mockRejectedValue(new Error("enroll failed"));
    const { result } = renderHook(() => useSecuritySettings());
    await waitFor(() => expect(result.current.status).toEqual(baseStatus));

    await act(async () => {
      await result.current.sendEnrollCode();
    });

    expect(result.current.error).toBe("enroll failed");
    expect(result.current.stage).toBe("idle");
  });

  it("confirms enrollment, refreshes status and clears local state", async () => {
    startMfaEnrollMock.mockResolvedValue({ challengeId: "ch-2" });
    verifyMfaEnrollMock.mockResolvedValue(enabledStatus);
    getSecurityMock.mockResolvedValue(enabledStatus);

    const { result } = renderHook(() => useSecuritySettings());
    await waitFor(() => expect(result.current.status).toEqual(enabledStatus));

    act(() => result.current.setEmail("user@test.com"));
    await act(async () => {
      await result.current.sendEnrollCode();
    });
    act(() => result.current.setCode("  999000  "));
    await act(async () => {
      await result.current.confirmEnroll();
    });

    expect(verifyMfaEnrollMock).toHaveBeenCalledWith("ch-2", "999000");
    expect(result.current.stage).toBe("idle");
    expect(result.current.email).toBe("");
    expect(result.current.code).toBe("");
    expect(result.current.status).toEqual(enabledStatus);
  });

  it("confirmEnroll is a no-op without a challenge id", async () => {
    const { result } = renderHook(() => useSecuritySettings());
    await waitFor(() => expect(result.current.status).toEqual(baseStatus));

    await act(async () => {
      await result.current.confirmEnroll();
    });

    expect(verifyMfaEnrollMock).not.toHaveBeenCalled();
  });

  it("cancelEnroll resets the enrollment flow", async () => {
    startMfaEnrollMock.mockResolvedValue({ challengeId: "ch-3" });
    const { result } = renderHook(() => useSecuritySettings());
    await waitFor(() => expect(result.current.status).toEqual(baseStatus));

    act(() => result.current.setEmail("user@test.com"));
    await act(async () => {
      await result.current.sendEnrollCode();
    });
    act(() => result.current.setCode("111"));

    act(() => result.current.cancelEnroll());

    expect(result.current.stage).toBe("idle");
    expect(result.current.code).toBe("");
    expect(result.current.error).toBeNull();
  });

  it("disables 2FA and refreshes status", async () => {
    disableMfaMock.mockResolvedValue(baseStatus);
    getSecurityMock.mockResolvedValueOnce(enabledStatus).mockResolvedValue(baseStatus);

    const { result } = renderHook(() => useSecuritySettings());
    await waitFor(() => expect(result.current.status).toEqual(enabledStatus));

    await act(async () => {
      await result.current.disable2FA();
    });

    expect(disableMfaMock).toHaveBeenCalledTimes(1);
    expect(result.current.status).toEqual(baseStatus);
  });

  it("toggles remember-me using the returned status", async () => {
    const remembered = { mfaEnabled: false, remember: true } as never;
    setRememberMock.mockResolvedValue(remembered);

    const { result } = renderHook(() => useSecuritySettings());
    await waitFor(() => expect(result.current.status).toEqual(baseStatus));

    await act(async () => {
      await result.current.toggleRemember(true);
    });

    expect(setRememberMock).toHaveBeenCalledWith(true);
    expect(result.current.status).toEqual(remembered);
  });

  it("signs out everywhere then resets the login session", async () => {
    revokeAllSessionsMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useSecuritySettings());
    await waitFor(() => expect(result.current.status).toEqual(baseStatus));

    await act(async () => {
      await result.current.signOutEverywhere();
    });

    expect(revokeAllSessionsMock).toHaveBeenCalledTimes(1);
    expect(mockReset).toHaveBeenCalledTimes(1);
  });
});
