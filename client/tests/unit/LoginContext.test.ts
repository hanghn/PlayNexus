import { describe, it, expect } from "vitest";
import { LoginContext } from "../../src/contexts/LoginContext.ts";

describe("LoginContext", () => {
  it("is a React context object", () => {
    expect(LoginContext).toBeDefined();
    expect(typeof LoginContext.Provider).toBe("object");
  });
});
