import { describe, it, expect } from "vitest";
import { createRepo } from "../src/keyv.ts";

// Exercises the in-memory Repo used by tests/local dev (the Supabase path only
// runs when SUPABASE_URL is configured).
describe("keyv in-memory repo", () => {
  it("add then get/find returns the stored value", async () => {
    const repo = createRepo<{ n: number }>("kvtest-a");
    const key = await repo.add({ n: 1 });
    expect(await repo.get(key)).toEqual({ n: 1 });
    expect(await repo.find(key)).toEqual({ n: 1 });
  });

  it("find returns null for a missing key, get rejects", async () => {
    const repo = createRepo("kvtest-b");
    expect(await repo.find("nope")).toBeNull();
    await expect(repo.get("nope")).rejects.toThrow();
  });

  it("set overwrites; getAllKeys and entries reflect contents", async () => {
    const repo = createRepo<number>("kvtest-c");
    await repo.set("k1", 1);
    await repo.set("k1", 2);
    await repo.set("k2", 3);
    expect(await repo.get("k1")).toBe(2);
    expect((await repo.getAllKeys()).sort()).toEqual(["k1", "k2"]);
    expect(await repo.entries()).toHaveLength(2);
  });

  it("getMany returns values, or rejects on a missing key", async () => {
    const repo = createRepo<number>("kvtest-d");
    await repo.set("a", 1);
    await repo.set("b", 2);
    expect(await repo.getMany(["a", "b"])).toEqual([1, 2]);
    await expect(repo.getMany(["a", "missing"])).rejects.toThrow();
  });

  it("clear empties the repo", async () => {
    const repo = createRepo<number>("kvtest-e");
    await repo.set("a", 1);
    await repo.clear();
    expect(await repo.getAllKeys()).toEqual([]);
  });
});
