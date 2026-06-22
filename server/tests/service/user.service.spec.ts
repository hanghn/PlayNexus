import { describe, expect, it, vi, beforeEach } from "vitest";
import { updateUser } from "../../src/services/user.service.ts";
import {
  enforceAuth,
  checkAuth,
  getUserFromSupabaseToken,
  enforceAuthToken,
} from "../../src/services/auth.service.ts";
import * as supabaseAdmin from "../../src/supabaseAdmin.ts";

// enforceAuth isn't tested by current integration tests,
// because existing tests exercise the REST api, and enforceAuth
// is only used in the socket api
describe("enforceAuth", () => {
  it("should return a user and id on good auth", async () => {
    const user = await enforceAuth({ username: "user1", password: "pwd1111" });
    expect(user).toStrictEqual({ userId: expect.any(String), username: "user1" });
  });

  it("should raise on bad auth", async () => {
    await expect(enforceAuth({ username: "user1", password: "no" })).rejects.toThrow();
  });
});

describe("checkAuth", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns null when Supabase token belongs to a different user", async () => {
    // Token resolves to "otheruser" but we claim to be "user1" — mismatch → null
    vi.spyOn(supabaseAdmin, "getSupabaseAdmin").mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "uid-other",
              email: "other@x.com",
              ["user_metadata"]: { username: "otheruser" },
            },
          },
          error: null,
        }),
      },
    } as never);

    const result = await checkAuth({ username: "user1", password: "Bearer some-token" });
    expect(result).toBeNull();
  });
});

describe("getUserFromSupabaseToken", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns null when no token is provided", async () => {
    expect(await getUserFromSupabaseToken(undefined)).toBeNull();
    expect(await getUserFromSupabaseToken("")).toBeNull();
  });

  it("returns null when Bearer prefix has no token after it", async () => {
    // "Bearer " splits to ["Bearer", ""] — empty string is falsy
    expect(await getUserFromSupabaseToken("Bearer ")).toBeNull();
  });

  it("falls back to empty string when both metadata.username and email are absent", async () => {
    vi.spyOn(supabaseAdmin, "getSupabaseAdmin").mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: "uid-no-email", email: undefined, ["user_metadata"]: {} },
          },
          error: null,
        }),
      },
    } as never);

    const result = await getUserFromSupabaseToken("some-token");
    expect(result).toStrictEqual({ username: "", userId: "uid-no-email" });
  });

  it("returns UserWithId on a valid Bearer token", async () => {
    vi.spyOn(supabaseAdmin, "getSupabaseAdmin").mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "supabase-uid-123",
              email: "test@example.com",
              ["user_metadata"]: { username: "supauser" },
            },
          },
          error: null,
        }),
      },
    } as never);

    const result = await getUserFromSupabaseToken("Bearer valid-token");
    expect(result).toStrictEqual({ username: "supauser", userId: "supabase-uid-123" });
  });

  it("falls back to email when username metadata is absent", async () => {
    vi.spyOn(supabaseAdmin, "getSupabaseAdmin").mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: "uid-456", email: "fallback@example.com", ["user_metadata"]: {} },
          },
          error: null,
        }),
      },
    } as never);

    const result = await getUserFromSupabaseToken("raw-token");
    expect(result).toStrictEqual({ username: "fallback@example.com", userId: "uid-456" });
  });

  it("returns null when Supabase returns an error", async () => {
    vi.spyOn(supabaseAdmin, "getSupabaseAdmin").mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error("invalid token"),
        }),
      },
    } as never);

    expect(await getUserFromSupabaseToken("bad-token")).toBeNull();
  });

  it("returns null when getSupabaseAdmin throws", async () => {
    vi.spyOn(supabaseAdmin, "getSupabaseAdmin").mockImplementation(() => {
      throw new Error("no supabase config");
    });

    expect(await getUserFromSupabaseToken("any-token")).toBeNull();
  });
});

describe("enforceAuthToken", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns UserWithId for a valid token", async () => {
    vi.spyOn(supabaseAdmin, "getSupabaseAdmin").mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: "uid-789", email: "x@y.com", ["user_metadata"]: { username: "tokenuser" } },
          },
          error: null,
        }),
      },
    } as never);

    const result = await enforceAuthToken("Bearer valid-token");
    expect(result).toStrictEqual({ username: "tokenuser", userId: "uid-789" });
  });

  it("throws when token is invalid", async () => {
    vi.spyOn(supabaseAdmin, "getSupabaseAdmin").mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("bad") }),
      },
    } as never);

    await expect(enforceAuthToken("bad-token")).rejects.toThrow("Invalid auth token");
  });
});

// updateUser can't be fully tested by current integration tests; part of its
// contract is that it throws if updateUser is called with an invalid user id,
// but a well-behaved controller won't ever invoke updateUser with an invalid
// user id
describe("updateUser", () => {
  it("should throw if given an invalid user id", async () => {
    await expect(updateUser("fake", { display: "Stacey Fakename" })).rejects.toThrow();
  });

  it("updates display, bio, accentColor and avatarUrl", async () => {
    const updated = await updateUser("user0", {
      display: "User Zero",
      bio: "hello there",
      accentColor: "#ff8800",
      avatarUrl: "https://example.com/avatar.png",
    });
    expect(updated.display).toBe("User Zero");
    expect(updated.bio).toBe("hello there");
    expect(updated.accentColor).toBe("#ff8800");
    expect(updated.avatarUrl).toBe("https://example.com/avatar.png");
  });
});
