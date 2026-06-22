// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const createClientMock = vi.fn(() => ({ __isSupabaseClient: true }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

async function importFresh() {
  vi.resetModules();
  return import("./supabaseClient");
}

describe("getSupabaseClient", () => {
  beforeEach(() => {
    createClientMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates a Supabase client when env vars are present", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key-123");

    const { getSupabaseClient } = await importFresh();
    const client = getSupabaseClient();

    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(createClientMock).toHaveBeenCalledWith("https://example.supabase.co", "anon-key-123");
    expect(client).toEqual({ __isSupabaseClient: true });
  });

  it("returns the same cached client on subsequent calls (singleton)", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key-123");

    const { getSupabaseClient } = await importFresh();
    const first = getSupabaseClient();
    const second = getSupabaseClient();

    expect(first).toBe(second);
    expect(createClientMock).toHaveBeenCalledTimes(1);
  });

  it("default export is the same function and shares the singleton", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key-123");

    const mod = await importFresh();
    expect(mod.default).toBe(mod.getSupabaseClient);

    const viaDefault = mod.default();
    const viaNamed = mod.getSupabaseClient();
    expect(viaDefault).toBe(viaNamed);
    expect(createClientMock).toHaveBeenCalledTimes(1);
  });

  it("throws when VITE_SUPABASE_URL is missing", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key-123");

    const { getSupabaseClient } = await importFresh();
    expect(() => getSupabaseClient()).toThrow(
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required for Supabase auth",
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("throws when VITE_SUPABASE_ANON_KEY is missing", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");

    const { getSupabaseClient } = await importFresh();
    expect(() => getSupabaseClient()).toThrow(
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required for Supabase auth",
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
