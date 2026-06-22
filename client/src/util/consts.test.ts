// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { gameNames } from "./consts";

describe("consts: gameNames", () => {
  it("maps each known GameKey to its display name", () => {
    expect(gameNames.nim).toBe("Nim");
    expect(gameNames.guess).toBe("Number Guesser");
    expect(gameNames.cribbage).toBe("Cribbage");
  });

  it("contains exactly the three supported game keys", () => {
    expect(Object.keys(gameNames).sort()).toEqual(["cribbage", "guess", "nim"]);
  });

  it("has non-empty string display names for every key", () => {
    for (const value of Object.values(gameNames)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
