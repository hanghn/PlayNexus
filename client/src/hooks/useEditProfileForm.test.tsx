// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock the consuming context hook so the form hook can be exercised in isolation.
const useLoginContextMock = vi.fn();
vi.mock("./useLoginContext.ts", () => ({
  default: () => useLoginContextMock(),
}));

// Mock useAuth so we control the auth object passed to updateUser.
const useAuthMock = vi.fn();
vi.mock("./useAuth.ts", () => ({
  default: () => useAuthMock(),
}));

// Mock the user service IO.
const updateUserMock = vi.fn();
vi.mock("../services/userService.ts", () => ({
  updateUser: (...args: unknown[]) => updateUserMock(...args),
}));

// Mock the image processing helper.
const fileToAvatarDataUrlMock = vi.fn();
vi.mock("../lib/image.ts", () => ({
  fileToAvatarDataUrl: (...args: unknown[]) => fileToAvatarDataUrlMock(...args),
}));

import useEditProfileForm from "./useEditProfileForm.ts";

const resetMock = vi.fn();
const patchUserMock = vi.fn();

const baseUser = {
  username: "alice",
  display: "Alice",
  bio: "hi there",
  accentColor: "#abc",
  avatarUrl: "data:old",
};

const auth = { username: "alice", password: "pw" };

const preventDefault = vi.fn();
const submitEvent = () =>
  ({ preventDefault }) as unknown as Parameters<
    ReturnType<typeof useEditProfileForm>["handleSubmit"]
  >[0];

beforeEach(() => {
  vi.clearAllMocks();
  useAuthMock.mockReturnValue(auth);
  useLoginContextMock.mockReturnValue({
    user: { ...baseUser },
    reset: resetMock,
    patchUser: patchUserMock,
  });
  updateUserMock.mockResolvedValue({ ...baseUser });
});

describe("useEditProfileForm", () => {
  it("initializes form state from the login context user", () => {
    const { result } = renderHook(() => useEditProfileForm());
    expect(result.current.display).toBe("Alice");
    expect(result.current.bio).toBe("hi there");
    expect(result.current.accent).toBe("#abc");
    expect(result.current.accentChoice).toBe("#abc");
    expect(result.current.avatarUrl).toBe("data:old");
    expect(result.current.password).toBe("");
    expect(result.current.confirm).toBe("");
    expect(result.current.err).toBeNull();
  });

  it("defaults optional user fields when they are missing", () => {
    useLoginContextMock.mockReturnValue({
      user: { username: "bob", display: "Bob" },
      reset: resetMock,
      patchUser: patchUserMock,
    });
    const { result } = renderHook(() => useEditProfileForm());
    expect(result.current.bio).toBe("");
    expect(result.current.accent).toBe("");
    expect(result.current.avatarUrl).toBe("");
  });

  describe("handleSaveBio", () => {
    it("trims, saves, patches and reports success", async () => {
      const { result } = renderHook(() => useEditProfileForm());
      act(() => result.current.setBio("  new bio  "));
      await act(async () => {
        await result.current.handleSaveBio({ preventDefault });
      });
      expect(preventDefault).toHaveBeenCalled();
      expect(updateUserMock).toHaveBeenCalledWith(auth, { bio: "new bio" });
      expect(patchUserMock).toHaveBeenCalledWith({ bio: "new bio" });
      expect(result.current.bio).toBe("new bio");
      expect(result.current.bioStatus).toBe("Bio saved");
    });

    it("reports the error message on failure", async () => {
      updateUserMock.mockRejectedValueOnce(new Error("boom"));
      const { result } = renderHook(() => useEditProfileForm());
      await act(async () => {
        await result.current.handleSaveBio({ preventDefault });
      });
      expect(result.current.bioStatus).toBe("Error: boom");
      expect(patchUserMock).not.toHaveBeenCalled();
    });
  });

  describe("handleSaveAccent", () => {
    it("saves the picked accent, applies it, and patches", async () => {
      const { result } = renderHook(() => useEditProfileForm());
      act(() => result.current.setAccentChoice("#fff"));
      await act(async () => {
        await result.current.handleSaveAccent({ preventDefault });
      });
      expect(updateUserMock).toHaveBeenCalledWith(auth, { accentColor: "#fff" });
      expect(result.current.accent).toBe("#fff");
      expect(patchUserMock).toHaveBeenCalledWith({ accentColor: "#fff" });
      expect(result.current.accentStatus).toBe("Color saved");
    });

    it("reports the error on failure", async () => {
      updateUserMock.mockRejectedValueOnce(new Error("nope"));
      const { result } = renderHook(() => useEditProfileForm());
      await act(async () => {
        await result.current.handleSaveAccent({ preventDefault });
      });
      expect(result.current.accentStatus).toBe("Error: nope");
      expect(result.current.accent).toBe("#abc");
    });
  });

  describe("handleSaveAvatar", () => {
    it("resizes, saves, patches and toggles savingAvatar", async () => {
      fileToAvatarDataUrlMock.mockResolvedValue("data:new");
      const file = new File(["x"], "a.png", { type: "image/png" });
      const { result } = renderHook(() => useEditProfileForm());
      await act(async () => {
        await result.current.handleSaveAvatar(file);
      });
      expect(fileToAvatarDataUrlMock).toHaveBeenCalledWith(file);
      expect(updateUserMock).toHaveBeenCalledWith(auth, { avatarUrl: "data:new" });
      expect(result.current.avatarUrl).toBe("data:new");
      expect(patchUserMock).toHaveBeenCalledWith({ avatarUrl: "data:new" });
      expect(result.current.avatarStatus).toBe("Avatar updated");
      expect(result.current.savingAvatar).toBe(false);
    });

    it("reports an Error's message on failure", async () => {
      fileToAvatarDataUrlMock.mockRejectedValueOnce(new Error("bad image"));
      const file = new File(["x"], "a.png", { type: "image/png" });
      const { result } = renderHook(() => useEditProfileForm());
      await act(async () => {
        await result.current.handleSaveAvatar(file);
      });
      expect(result.current.avatarStatus).toBe("bad image");
      expect(result.current.savingAvatar).toBe(false);
    });

    it("stringifies non-Error failures", async () => {
      fileToAvatarDataUrlMock.mockRejectedValueOnce("plain string");
      const file = new File(["x"], "a.png", { type: "image/png" });
      const { result } = renderHook(() => useEditProfileForm());
      await act(async () => {
        await result.current.handleSaveAvatar(file);
      });
      expect(result.current.avatarStatus).toBe("plain string");
    });
  });

  describe("handleClearAvatar", () => {
    it("clears the avatar and reports removal", async () => {
      const { result } = renderHook(() => useEditProfileForm());
      await act(async () => {
        await result.current.handleClearAvatar();
      });
      expect(updateUserMock).toHaveBeenCalledWith(auth, { avatarUrl: "" });
      expect(result.current.avatarUrl).toBe("");
      expect(patchUserMock).toHaveBeenCalledWith({ avatarUrl: "" });
      expect(result.current.avatarStatus).toBe("Avatar removed");
    });

    it("reports the error message on failure", async () => {
      updateUserMock.mockRejectedValueOnce(new Error("cannot clear"));
      const { result } = renderHook(() => useEditProfileForm());
      await act(async () => {
        await result.current.handleClearAvatar();
      });
      expect(result.current.avatarStatus).toBe("cannot clear");
    });
  });

  describe("handleSubmit", () => {
    it("errors when there are no changes to submit", async () => {
      const { result } = renderHook(() => useEditProfileForm());
      await act(async () => {
        await result.current.handleSubmit(submitEvent());
      });
      expect(preventDefault).toHaveBeenCalled();
      expect(result.current.err).toBe("No changes to submit");
      expect(updateUserMock).not.toHaveBeenCalled();
    });

    it("rejects a display name with surrounding whitespace", async () => {
      const { result } = renderHook(() => useEditProfileForm());
      act(() => result.current.setDisplay(" Alice "));
      await act(async () => {
        await result.current.handleSubmit(submitEvent());
      });
      expect(result.current.err).toBe("Display names can't begin or end with whitespace");
    });

    it("rejects an empty display name", async () => {
      const { result } = renderHook(() => useEditProfileForm());
      act(() => result.current.setDisplay(""));
      await act(async () => {
        await result.current.handleSubmit(submitEvent());
      });
      expect(result.current.err).toBe("Please enter a display name");
    });

    it("rejects a password with surrounding whitespace", async () => {
      const { result } = renderHook(() => useEditProfileForm());
      act(() => {
        result.current.setPassword(" pw ");
        result.current.setConfirm(" pw ");
      });
      await act(async () => {
        await result.current.handleSubmit(submitEvent());
      });
      expect(result.current.err).toBe("Passwords can't begin or end with whitespace");
    });

    it("rejects mismatched passwords", async () => {
      const { result } = renderHook(() => useEditProfileForm());
      act(() => {
        result.current.setPassword("aaa");
        result.current.setConfirm("bbb");
      });
      await act(async () => {
        await result.current.handleSubmit(submitEvent());
      });
      expect(result.current.err).toBe("Passwords don't match");
    });

    it("submits a display change and resets the login context", async () => {
      const { result } = renderHook(() => useEditProfileForm());
      act(() => result.current.setDisplay("NewName"));
      await act(async () => {
        await result.current.handleSubmit(submitEvent());
      });
      expect(updateUserMock).toHaveBeenCalledWith(auth, { display: "NewName" });
      expect(resetMock).toHaveBeenCalled();
    });

    it("submits a password change", async () => {
      const { result } = renderHook(() => useEditProfileForm());
      act(() => {
        result.current.setPassword("newpass");
        result.current.setConfirm("newpass");
      });
      await act(async () => {
        await result.current.handleSubmit(submitEvent());
      });
      expect(updateUserMock).toHaveBeenCalledWith(auth, { password: "newpass" });
      expect(resetMock).toHaveBeenCalled();
    });

    it("surfaces a server error and does not reset", async () => {
      updateUserMock.mockRejectedValueOnce(new Error("server down"));
      const { result } = renderHook(() => useEditProfileForm());
      act(() => result.current.setDisplay("NewName"));
      await act(async () => {
        await result.current.handleSubmit(submitEvent());
      });
      expect(result.current.err).toBe("Error: server down");
      expect(resetMock).not.toHaveBeenCalled();
    });
  });

  it("tolerates a missing patchUser callback", async () => {
    useLoginContextMock.mockReturnValue({
      user: { ...baseUser },
      reset: resetMock,
      patchUser: undefined,
    });
    const { result } = renderHook(() => useEditProfileForm());
    await act(async () => {
      await result.current.handleSaveBio({ preventDefault });
    });
    expect(result.current.bioStatus).toBe("Bio saved");
  });
});
