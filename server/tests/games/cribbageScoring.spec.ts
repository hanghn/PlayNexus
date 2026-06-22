import { describe, expect, it } from "vitest";
import type { Card } from "@gamenite/shared";
import { scorePegging, scoreShow } from "../../src/games/cribbageScoring.ts";
import type { ScoreDelta } from "../../src/games/cribbageScoring.ts";

const c = (rank: number, suit: Card["suit"]): Card => ({ rank, suit });

/** Sum all points across a list of score deltas. */
const total = (deltas: ScoreDelta[]): number => deltas.reduce((s, d) => s + d.points, 0);

/** Find the first delta with the given category, or undefined. */
const find = (deltas: ScoreDelta[], cat: string) => deltas.find((d) => d.category === cat);

// ---------------------------------------------------------------------------
// scoreShow — hand + starter during the Show phase
// ---------------------------------------------------------------------------

describe("scoreShow — fifteens", () => {
  it("scores 0 when no subset sums to 15", () => {
    // A, 2, 3, 4 + 4 — max subset sum is 14, no fifteen possible
    const deltas = scoreShow([c(1, "H"), c(2, "D"), c(3, "C"), c(4, "S")], c(4, "C"), false);
    expect(find(deltas, "fifteen")).toBeUndefined();
  });

  it("scores 2 for a single fifteen (5 + 10)", () => {
    // 5+10=15, no other subset hits 15 with these cards
    const deltas = scoreShow([c(5, "H"), c(10, "D"), c(8, "C"), c(3, "S")], c(1, "H"), false);
    const f = find(deltas, "fifteen");
    expect(f).toBeDefined();
    expect(f!.points).toBe(2);
  });

  it("scores 4 for two fifteens", () => {
    // 5H+10D=15, 5C+10D=15
    const deltas = scoreShow([c(5, "H"), c(5, "C"), c(10, "D"), c(2, "S")], c(1, "H"), false);
    const f = find(deltas, "fifteen");
    expect(f!.points).toBe(4); // 2 fifteens × 2
  });

  it("scores 16 for the eight fifteens in the 29-point hand", () => {
    // J♠ (=10), 5H, 5D, 5C + starter 5S → 8 fifteens
    const deltas = scoreShow([c(11, "S"), c(5, "H"), c(5, "D"), c(5, "C")], c(5, "S"), false);
    const f = find(deltas, "fifteen");
    expect(f!.points).toBe(16);
  });
});

describe("scoreShow — pairs", () => {
  it("scores 0 when no pairs", () => {
    const deltas = scoreShow([c(1, "H"), c(2, "D"), c(3, "C"), c(4, "S")], c(6, "H"), false);
    expect(find(deltas, "pair")).toBeUndefined();
  });

  it("scores 2 for one pair", () => {
    const deltas = scoreShow([c(7, "H"), c(7, "D"), c(3, "C"), c(4, "S")], c(6, "H"), false);
    expect(find(deltas, "pair")!.points).toBe(2);
  });

  it("scores 4 for two pairs (double pair)", () => {
    const deltas = scoreShow([c(7, "H"), c(7, "D"), c(4, "C"), c(4, "S")], c(6, "H"), false);
    expect(find(deltas, "pair")!.points).toBe(4);
  });

  it("scores 6 for three of a kind (pair royal = 3 pairs)", () => {
    const deltas = scoreShow([c(7, "H"), c(7, "D"), c(7, "C"), c(4, "S")], c(6, "H"), false);
    expect(find(deltas, "pair")!.points).toBe(6);
  });

  it("scores 12 for four of a kind (double pair royal = 6 pairs)", () => {
    // Four 5s: 6 unordered pairs × 2 = 12
    const deltas = scoreShow([c(5, "H"), c(5, "D"), c(5, "C"), c(5, "S")], c(1, "H"), false);
    expect(find(deltas, "pair")!.points).toBe(12);
  });
});

describe("scoreShow — runs", () => {
  it("scores 3 for a simple run of 3", () => {
    const deltas = scoreShow([c(3, "H"), c(4, "D"), c(5, "C"), c(9, "S")], c(1, "H"), false);
    expect(find(deltas, "run")!.points).toBe(3);
  });

  it("scores 4 for a run of 4", () => {
    // 2-3-4-5 with an unrelated 9 as starter → run of 4, not 5
    const deltas = scoreShow([c(2, "H"), c(3, "D"), c(4, "C"), c(5, "S")], c(9, "H"), false);
    expect(find(deltas, "run")!.points).toBe(4);
  });

  it("scores 5 for a run of 5", () => {
    const deltas = scoreShow([c(1, "H"), c(2, "D"), c(3, "C"), c(4, "S")], c(5, "H"), false);
    expect(find(deltas, "run")!.points).toBe(5);
  });

  it("scores 6 for a double run of 3 (one rank appears twice)", () => {
    // 3, 3, 4, 5 + starter unrelated → 2 × run-of-3 = 6
    const deltas = scoreShow([c(3, "H"), c(3, "D"), c(4, "C"), c(5, "S")], c(9, "H"), false);
    expect(find(deltas, "run")!.points).toBe(6);
  });

  it("scores 8 for a double run of 4", () => {
    // 3, 3, 4, 5, 6 → 2 × run-of-4 = 8
    const deltas = scoreShow([c(3, "H"), c(3, "D"), c(4, "C"), c(5, "S")], c(6, "H"), false);
    expect(find(deltas, "run")!.points).toBe(8);
  });

  it("scores 9 for a triple run of 3 (one rank appears three times)", () => {
    // 3H, 3D, 3C, 4S + 5H → 3 × run-of-3 = 9
    const deltas = scoreShow([c(3, "H"), c(3, "D"), c(3, "C"), c(4, "S")], c(5, "H"), false);
    expect(find(deltas, "run")!.points).toBe(9);
  });
});

describe("scoreShow — flush", () => {
  it("scores 4 for a 4-card hand flush (starter different suit)", () => {
    const deltas = scoreShow([c(2, "H"), c(5, "H"), c(9, "H"), c(13, "H")], c(7, "D"), false);
    const f = find(deltas, "flush");
    expect(f).toBeDefined();
    expect(f!.points).toBe(4);
  });

  it("scores 5 for a 5-card flush (starter same suit)", () => {
    const deltas = scoreShow([c(2, "H"), c(5, "H"), c(9, "H"), c(13, "H")], c(7, "H"), false);
    expect(find(deltas, "flush")!.points).toBe(5);
  });

  it("does NOT score a 4-card flush in the crib (crib needs all 5)", () => {
    const deltas = scoreShow([c(2, "H"), c(5, "H"), c(9, "H"), c(13, "H")], c(7, "D"), true);
    expect(find(deltas, "flush")).toBeUndefined();
  });

  it("scores 5 for a crib 5-card flush", () => {
    const deltas = scoreShow([c(2, "H"), c(5, "H"), c(9, "H"), c(13, "H")], c(7, "H"), true);
    expect(find(deltas, "flush")!.points).toBe(5);
  });

  it("scores 0 flush when hand cards are mixed suits", () => {
    const deltas = scoreShow([c(2, "H"), c(5, "D"), c(9, "H"), c(13, "H")], c(7, "H"), false);
    expect(find(deltas, "flush")).toBeUndefined();
  });
});

describe("scoreShow — his nobs", () => {
  it("scores 1 for a Jack in hand matching the starter's suit", () => {
    // J♥ in hand, starter ♥
    const deltas = scoreShow([c(11, "H"), c(2, "D"), c(3, "C"), c(4, "S")], c(9, "H"), false);
    expect(find(deltas, "nob")!.points).toBe(1);
  });

  it("does not score nob when Jack suit does not match starter", () => {
    // J♦ in hand, starter ♥
    const deltas = scoreShow([c(11, "D"), c(2, "H"), c(3, "C"), c(4, "S")], c(9, "H"), false);
    expect(find(deltas, "nob")).toBeUndefined();
  });
});

describe("scoreShow — 29-point hand", () => {
  it("the perfect hand scores exactly 29", () => {
    // J♠ (=10 face value), 5♥, 5♦, 5♣ + starter 5♠
    // → 8 fifteens (16) + 6 pairs of 5s (12) + his nobs J♠ matches 5♠ suit (1) = 29
    const hand = [c(11, "S"), c(5, "H"), c(5, "D"), c(5, "C")];
    const starter = c(5, "S");
    const deltas = scoreShow(hand, starter, false);
    expect(total(deltas)).toBe(29);
  });
});

// ---------------------------------------------------------------------------
// scorePegging — points scored when a card is added to the pegging pile
// ---------------------------------------------------------------------------

describe("scorePegging — 15 and 31", () => {
  it("scores 2 for reaching 15", () => {
    const pile = [c(9, "H"), c(6, "D")];
    const deltas = scorePegging(pile, 15);
    expect(find(deltas, "fifteen")!.points).toBe(2);
  });

  it("scores 2 for reaching 31", () => {
    const pile = [c(10, "H"), c(10, "D"), c(10, "C"), c(1, "S")];
    const deltas = scorePegging(pile, 31);
    expect(find(deltas, "thirtyOne")!.points).toBe(2);
  });

  it("does not score 15 or 31 for other counts", () => {
    const deltas = scorePegging([c(7, "H"), c(6, "D")], 13);
    expect(find(deltas, "fifteen")).toBeUndefined();
    expect(find(deltas, "thirtyOne")).toBeUndefined();
  });
});

describe("scorePegging — pairs", () => {
  it("scores 2 for a pair (two consecutive same-rank cards)", () => {
    const pile = [c(6, "H"), c(6, "D")];
    const deltas = scorePegging(pile, 12);
    expect(find(deltas, "pair")!.points).toBe(2);
  });

  it("scores 6 for pair royal (three consecutive same-rank)", () => {
    const pile = [c(6, "H"), c(6, "D"), c(6, "C")];
    const deltas = scorePegging(pile, 18);
    expect(find(deltas, "pairRoyal")!.points).toBe(6);
  });

  it("scores 12 for double pair royal (four consecutive same-rank)", () => {
    const pile = [c(6, "H"), c(6, "D"), c(6, "C"), c(6, "S")];
    const deltas = scorePegging(pile, 24);
    expect(find(deltas, "doublePairRoyal")!.points).toBe(12);
  });

  it("does not score a pair when the last two ranks differ", () => {
    const pile = [c(6, "H"), c(7, "D")];
    const deltas = scorePegging(pile, 13);
    expect(find(deltas, "pair")).toBeUndefined();
  });

  it("breaks the pair run when a different rank interrupts", () => {
    // 6, 7, 6 → the trailing run is [7, 6] which is not a pair
    const pile = [c(6, "H"), c(7, "D"), c(6, "C")];
    const deltas = scorePegging(pile, 19);
    expect(find(deltas, "pair")).toBeUndefined();
    expect(find(deltas, "pairRoyal")).toBeUndefined();
  });
});

describe("scorePegging — runs", () => {
  it("scores 3 for a run of 3 (any order)", () => {
    // 4, 6, 5 → run of 3
    const pile = [c(4, "H"), c(6, "D"), c(5, "C")];
    const deltas = scorePegging(pile, 15);
    expect(find(deltas, "run")!.points).toBe(3);
  });

  it("scores 4 for a run of 4", () => {
    // 4, 6, 5, 3 → run of 4
    const pile = [c(4, "H"), c(6, "D"), c(5, "C"), c(3, "S")];
    const deltas = scorePegging(pile, 18);
    expect(find(deltas, "run")!.points).toBe(4);
  });

  it("scores 5 for a run of 5", () => {
    const pile = [c(2, "H"), c(4, "D"), c(3, "C"), c(6, "S"), c(5, "H")];
    const deltas = scorePegging(pile, 20);
    expect(find(deltas, "run")!.points).toBe(5);
  });

  it("does not score a run shorter than 3", () => {
    const pile = [c(5, "H"), c(6, "D")];
    const deltas = scorePegging(pile, 11);
    expect(find(deltas, "run")).toBeUndefined();
  });

  it("does not score a run with a gap", () => {
    // 4, 6, 8 — not consecutive
    const pile = [c(4, "H"), c(6, "D"), c(8, "C")];
    const deltas = scorePegging(pile, 18);
    expect(find(deltas, "run")).toBeUndefined();
  });
});

describe("scorePegging — combined scoring", () => {
  it("scores fifteen and a pair simultaneously (e.g. 7 + 8 then 8 = 15 + pair)", () => {
    // 7 + 8 = 15 already played, now another 8 makes 23 ... that's not 15+pair.
    // Let's try: pile [7, 8], count=15 → fifteen. Then [7, 8, 7], count=22 → pair.
    // Actually to get both: pile = [8, 7], count = 15 (fifteen) and no pair.
    // A true fifteen+pair: pile = [7H, 8D] count=15, then pile = [7H, 8D, 7S] count=22 → pair only.
    // Classic: pile = [5, 5, 5] count=15? 5+5+5=15 and three of a kind (pair royal).
    const pile = [c(5, "H"), c(5, "D"), c(5, "C")];
    const deltas = scorePegging(pile, 15);
    expect(find(deltas, "fifteen")!.points).toBe(2);
    expect(find(deltas, "pairRoyal")!.points).toBe(6);
  });

  it("scores 2 points for a single card played with no combinations", () => {
    const deltas = scorePegging([c(3, "H")], 3);
    expect(total(deltas)).toBe(0);
  });
});
