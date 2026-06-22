// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAuthToken, loadAuthToken, saveAuthToken } from "./authStorage";

const KEY = "gamenite.authToken";

describe("authStorage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("saves a token to sessionStorage as JSON", () => {
    saveAuthToken("alice", "secret");
    expect(sessionStorage.getItem(KEY)).toBe(JSON.stringify({ username: "alice", pass: "secret" }));
  });

  it("round-trips a saved token via loadAuthToken", () => {
    saveAuthToken("bob", "pw123");
    expect(loadAuthToken()).toEqual({ username: "bob", pass: "pw123" });
  });

  it("returns null when nothing is stored", () => {
    expect(loadAuthToken()).toBeNull();
  });

  it("returns null when stored JSON is invalid", () => {
    sessionStorage.setItem(KEY, "not-json{");
    expect(loadAuthToken()).toBeNull();
  });

  it("returns null when stored value is the wrong shape", () => {
    sessionStorage.setItem(KEY, JSON.stringify({ username: "x" }));
    expect(loadAuthToken()).toBeNull();
  });

  it("returns null when stored value is a non-object JSON primitive", () => {
    sessionStorage.setItem(KEY, JSON.stringify("hello"));
    expect(loadAuthToken()).toBeNull();
  });

  it("returns null when stored value is JSON null", () => {
    sessionStorage.setItem(KEY, JSON.stringify(null));
    expect(loadAuthToken()).toBeNull();
  });

  it("returns null when fields are non-string types", () => {
    sessionStorage.setItem(KEY, JSON.stringify({ username: 1, pass: true }));
    expect(loadAuthToken()).toBeNull();
  });

  it("clears a stored token", () => {
    saveAuthToken("carol", "pw");
    expect(loadAuthToken()).not.toBeNull();
    clearAuthToken();
    expect(loadAuthToken()).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it("swallows errors when setItem throws (storage unavailable)", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    expect(() => saveAuthToken("a", "b")).not.toThrow();
    spy.mockRestore();
  });

  it("returns null when getItem throws", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadAuthToken()).toBeNull();
    spy.mockRestore();
  });

  it("swallows errors when removeItem throws", () => {
    const spy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => clearAuthToken()).not.toThrow();
    spy.mockRestore();
  });
});
