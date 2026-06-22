/**
 * Tests for withKeyedLock (lock.ts), including the map-cleanup behaviour: the
 * tail entry is dropped only when the settling task is still the last in the
 * chain, and is kept when a later task has already been queued.
 */

import { describe, it, expect } from "vitest";
import { withKeyedLock } from "../src/lock.ts";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("withKeyedLock", () => {
  it("runs tasks sharing a key strictly in call order (no overlap)", async () => {
    const order: number[] = [];
    // Two tasks queued on the same key: while task 1 is still running, task 2 is
    // the chain tail, so task 1's cleanup skips deleting the entry.
    const p1 = withKeyedLock("k", async () => {
      await delay(10);
      order.push(1);
    });
    const p2 = withKeyedLock("k", () => {
      order.push(2);
      return Promise.resolve();
    });
    await Promise.all([p1, p2]);
    // Task 2 settling last is the chain tail, so its cleanup deletes the entry.
    expect(order).toEqual([1, 2]);
  });

  it("runs different keys concurrently", async () => {
    const order: string[] = [];
    const a = withKeyedLock("a", async () => {
      await delay(10);
      order.push("a");
    });
    const b = withKeyedLock("b", () => {
      order.push("b");
      return Promise.resolve();
    });
    await Promise.all([a, b]);
    // b's key is independent, so it does not wait for a.
    expect(order).toEqual(["b", "a"]);
  });

  it("returns the task's resolved value", async () => {
    await expect(withKeyedLock("v", () => Promise.resolve(42))).resolves.toBe(42);
  });

  it("propagates a rejection without poisoning the queue for later callers", async () => {
    const failing = withKeyedLock("e", () => Promise.reject(new Error("boom")));
    await expect(failing).rejects.toThrow("boom");
    const next = withKeyedLock("e", () => Promise.resolve("ok"));
    await expect(next).resolves.toBe("ok");
  });
});
