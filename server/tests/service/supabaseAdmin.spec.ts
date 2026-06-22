import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock createClient so tests never hit a real Supabase instance.
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth: { persistSession: false } })),
}));

describe("getSupabaseAdmin", () => {
  const origURL = process.env.SUPABASE_URL;
  const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    vi.resetModules();
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  });

  afterEach(() => {
    if (origURL !== undefined) process.env.SUPABASE_URL = origURL;
    else delete process.env.SUPABASE_URL;
    if (origKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("throws when SUPABASE_URL is not set", async () => {
    delete process.env.SUPABASE_URL;
    const { getSupabaseAdmin } = await import("../../src/supabaseAdmin.ts");
    expect(() => getSupabaseAdmin()).toThrow(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Supabase auth",
    );
  });

  it("throws when SUPABASE_SERVICE_ROLE_KEY is not set", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { getSupabaseAdmin } = await import("../../src/supabaseAdmin.ts");
    expect(() => getSupabaseAdmin()).toThrow(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Supabase auth",
    );
  });

  it("creates and returns a Supabase client when credentials are present", async () => {
    const { getSupabaseAdmin } = await import("../../src/supabaseAdmin.ts");
    const client = getSupabaseAdmin();
    expect(client).toBeDefined();
  });

  it("returns the same cached client on repeated calls", async () => {
    const { getSupabaseAdmin } = await import("../../src/supabaseAdmin.ts");
    const first = getSupabaseAdmin();
    const second = getSupabaseAdmin();
    expect(first).toBe(second);
  });
});
