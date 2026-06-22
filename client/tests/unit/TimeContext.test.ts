import { describe, it, expect } from "vitest";
import { TimeContext } from "../../src/contexts/TimeContext.tsx";

describe("TimeContext", () => {
  it("is a React context object", () => {
    expect(TimeContext).toBeDefined();
    expect(typeof TimeContext.Provider).toBe("object");
  });
});
