import { describe, expect, it } from "vitest";
import type { Card, CribbageView, CribbageState } from "@gamenite/shared";
import { easyAIMove, hardAIMove } from "../../src/games/cribbageAI.ts";
import { cribbageLogic } from "../../src/games/cribbage.ts";

// Helpers

const card = (rank: number, suit: Card["suit"]): Card => ({ rank, suit });

/** A minimal CribbageView skeleton — spread to override only what each test needs. */
const baseView = (overrides: Partial<CribbageView> = {}): CribbageView => ({
  phase: "play",
  dealer: 0,
  myIndex: 1,
  myHand: [],
  opponentHand: null,
  opponentHandSize: 0,
  crib: null,
  cribSize: 0,
  starter: null,
  playPile: [],
  runningCount: 0,
  scores: [0, 0],
  nextPlayer: 1,
  myReady: false,
  opponentReady: false,
  cutDeckSize: 52,
  myCut: null,
  opponentCut: null,
  opponentHasCut: false,
  log: [],
  winner: null,
  ...overrides,
});

/**
 * Run a complete cribbage game between two AI move selectors. Returns the
 * final state (phase "done") after at most `maxMoves` moves.
 *
 * Cut-phase note: both AIs wait for the opponent to cut first (correct for a
 * real game where neither wants to reveal their card). To avoid deadlock in
 * simulation we assign player 0 as the "first cutter" — we force their cut
 * using a raw view override before asking player 1 to respond.
 */
function playGame(
  playerZeroAI: (v: CribbageView) => ReturnType<typeof easyAIMove>,
  playerOneAI: (v: CribbageView) => ReturnType<typeof easyAIMove>,
  maxMoves = 2000,
): CribbageState {
  let state = cribbageLogic.start(2);

  for (let step = 0; step < maxMoves; step++) {
    if (cribbageLogic.isDone(state)) break;

    let moved = false;
    for (const pi of [0, 1] as const) {
      const view = cribbageLogic.viewAs(state, pi);

      // Break the cut-phase deadlock: player 0 always cuts first; player 1
      // sees the view with opponentHasCut=true so it knows to respond.
      const adjustedView: CribbageView =
        view.phase === "cut" && pi === 0
          ? { ...view, opponentHasCut: true } // override so p0 cuts without waiting
          : view;

      const move = pi === 0 ? playerZeroAI(adjustedView) : playerOneAI(adjustedView);
      if (move) {
        const next = cribbageLogic.update(state, move, pi);
        if (next) {
          state = next;
          moved = true;
          break;
        }
      }
    }

    if (!moved) break;
  }

  return state;
}

// Easy AI — valid moves in every phase

describe("Easy AI — cut phase", () => {
  it("returns null when opponent has not yet cut", () => {
    expect(easyAIMove(baseView({ phase: "cut", opponentHasCut: false }))).toBeNull();
  });

  it("returns null when the AI has already cut", () => {
    expect(
      easyAIMove(baseView({ phase: "cut", opponentHasCut: true, myCut: card(5, "H") })),
    ).toBeNull();
  });

  it("returns a cut move with an in-range index once the opponent has cut", () => {
    const move = easyAIMove(baseView({ phase: "cut", opponentHasCut: true, cutDeckSize: 20 }));
    expect(move?.type).toBe("cut");
    if (move?.type === "cut") {
      expect(move.index).toBeGreaterThanOrEqual(0);
      expect(move.index).toBeLessThan(20);
    }
  });
});

describe("Easy AI — deal phase", () => {
  it("sends ready when not ready", () => {
    const move = easyAIMove(baseView({ phase: "deal", myReady: false }));
    expect(move).toEqual({ type: "ready" });
  });

  it("returns null when already ready", () => {
    expect(easyAIMove(baseView({ phase: "deal", myReady: true }))).toBeNull();
  });
});

describe("Easy AI — discard phase", () => {
  const hand: Card[] = [
    card(1, "H"),
    card(2, "D"),
    card(3, "C"),
    card(4, "S"),
    card(5, "H"),
    card(6, "D"),
  ];

  it("discards exactly 2 cards from a 6-card hand", () => {
    const move = easyAIMove(baseView({ phase: "discard", myHand: hand }));
    expect(move?.type).toBe("discard");
    if (move?.type === "discard") {
      expect(move.cards).toHaveLength(2);
    }
  });

  it("only discards cards that are in the hand", () => {
    const move = easyAIMove(baseView({ phase: "discard", myHand: hand }));
    if (move?.type === "discard") {
      for (const c of move.cards) {
        expect(hand.some((h) => h.rank === c.rank && h.suit === c.suit)).toBe(true);
      }
    }
  });

  it("never discards the same card twice", () => {
    const move = easyAIMove(baseView({ phase: "discard", myHand: hand }));
    if (move?.type === "discard") {
      const [a, b] = move.cards;
      expect(a.rank === b.rank && a.suit === b.suit).toBe(false);
    }
  });

  it("returns null when hand already has 4 cards (already discarded)", () => {
    const fourCardHand = hand.slice(0, 4);
    expect(easyAIMove(baseView({ phase: "discard", myHand: fourCardHand }))).toBeNull();
  });
});

describe("Easy AI — play phase", () => {
  it("returns null when it is the opponent's turn", () => {
    const move = easyAIMove(
      baseView({
        phase: "play",
        myIndex: 1,
        nextPlayer: 0,
        myHand: [card(5, "H")],
        runningCount: 0,
      }),
    );
    expect(move).toBeNull();
  });

  it("plays a legal card that does not push count over 31", () => {
    const move = easyAIMove(
      baseView({
        phase: "play",
        myIndex: 0,
        nextPlayer: 0,
        myHand: [card(5, "H"), card(9, "D")],
        runningCount: 25, // only 5 fits (25+5=30 ≤ 31; 25+9=34 > 31)
      }),
    );
    expect(move?.type).toBe("play");
    if (move?.type === "play") {
      expect(move.card.rank).toBe(5);
    }
  });

  it("says go when no card can be played", () => {
    const move = easyAIMove(
      baseView({
        phase: "play",
        myIndex: 0,
        nextPlayer: 0,
        myHand: [card(10, "H"), card(13, "D")],
        runningCount: 22, // 22+10=32 and 22+10=32 — both bust
      }),
    );
    expect(move).toEqual({ type: "go" });
  });

  it("prefers a card that makes exactly 15", () => {
    // Count is 10; playing a 5 makes 15 — should prefer it over the 2
    const move = easyAIMove(
      baseView({
        phase: "play",
        myIndex: 0,
        nextPlayer: 0,
        myHand: [card(2, "H"), card(5, "D")],
        runningCount: 10,
      }),
    );
    expect(move?.type).toBe("play");
    if (move?.type === "play") expect(move.card.rank).toBe(5);
  });

  it("prefers a card that makes exactly 31", () => {
    // Count is 21; playing a 10 makes 31 — should prefer it over the 3
    const move = easyAIMove(
      baseView({
        phase: "play",
        myIndex: 0,
        nextPlayer: 0,
        myHand: [card(3, "H"), card(10, "D")],
        runningCount: 21,
      }),
    );
    expect(move?.type).toBe("play");
    if (move?.type === "play") expect(move.card.rank).toBe(10);
  });
});

describe("Easy AI — handover / show / done phases", () => {
  it("waits (returns null) during handover so the human chooses to play on or quit", () => {
    expect(easyAIMove(baseView({ phase: "handover" }))).toBeNull();
  });

  it("returns null during show", () => {
    expect(easyAIMove(baseView({ phase: "show" }))).toBeNull();
  });

  it("returns null during done", () => {
    expect(easyAIMove(baseView({ phase: "done", winner: 0 }))).toBeNull();
  });
});

// Hard AI — valid moves (same legality invariants as Easy)

describe("Hard AI — discard phase", () => {
  const hand: Card[] = [
    card(1, "H"),
    card(2, "D"),
    card(3, "C"),
    card(4, "S"),
    card(5, "H"),
    card(6, "D"),
  ];

  it("discards exactly 2 cards from hand", () => {
    const move = hardAIMove(baseView({ phase: "discard", myHand: hand }));
    expect(move?.type).toBe("discard");
    if (move?.type === "discard") expect(move.cards).toHaveLength(2);
  });

  it("only discards cards that are in the hand", () => {
    const move = hardAIMove(baseView({ phase: "discard", myHand: hand }));
    if (move?.type === "discard") {
      for (const c of move.cards) {
        expect(hand.some((h) => h.rank === c.rank && h.suit === c.suit)).toBe(true);
      }
    }
  });

  it("never discards the same card twice", () => {
    const move = hardAIMove(baseView({ phase: "discard", myHand: hand }));
    if (move?.type === "discard") {
      const [a, b] = move.cards;
      expect(a.rank === b.rank && a.suit === b.suit).toBe(false);
    }
  });
});

describe("Hard AI — discard quality", () => {
  it("as dealer keeps cards with a high show value over weak cards", () => {
    // Hand: 5H 5D 5C JS (dealer) — keeping three 5s + J is the classic strong crib hand.
    // The hard AI should discard the two weakest cards (2D, 3C) not from the scoring core.
    const hand: Card[] = [
      card(5, "H"),
      card(5, "D"),
      card(5, "C"),
      card(11, "S"),
      card(2, "D"),
      card(3, "C"),
    ];
    const move = hardAIMove(baseView({ phase: "discard", myHand: hand, dealer: 0, myIndex: 0 }));
    expect(move?.type).toBe("discard");
    if (move?.type === "discard") {
      // The discarded cards should NOT include any of the three 5s or the Jack
      const discardedRanks = move.cards.map((c) => c.rank);
      expect(discardedRanks).not.toContain(5);
      expect(discardedRanks).not.toContain(11);
    }
  });

  it("as pone avoids discarding 5s to the opponent's crib", () => {
    // As pone, the Hard AI should avoid donating 5s to the dealer's crib.
    // Hand: 5H 5D 2C 3S 8H 9D — the 5s are dangerous to donate.
    const hand: Card[] = [
      card(5, "H"),
      card(5, "D"),
      card(2, "C"),
      card(3, "S"),
      card(8, "H"),
      card(9, "D"),
    ];
    // dealer=0, myIndex=1 means I am pone
    const move = hardAIMove(baseView({ phase: "discard", myHand: hand, dealer: 0, myIndex: 1 }));
    expect(move?.type).toBe("discard");
    if (move?.type === "discard") {
      // The hard AI should keep both 5s (they score well in hand) rather than donate them
      const discardedRanks = move.cards.map((c) => c.rank);
      expect(discardedRanks.filter((r) => r === 5).length).toBeLessThan(2);
    }
  });
});

describe("Hard AI — play quality", () => {
  it("plays a card that scores immediately (makes 15)", () => {
    const move = hardAIMove(
      baseView({
        phase: "play",
        myIndex: 0,
        nextPlayer: 0,
        myHand: [card(2, "H"), card(5, "D"), card(9, "C")],
        runningCount: 10, // playing 5 → 15
      }),
    );
    expect(move?.type).toBe("play");
    if (move?.type === "play") expect(move.card.rank).toBe(5);
  });

  it("plays a card that scores immediately (makes 31)", () => {
    const move = hardAIMove(
      baseView({
        phase: "play",
        myIndex: 0,
        nextPlayer: 0,
        myHand: [card(3, "H"), card(10, "D")],
        runningCount: 21, // playing 10 → 31
      }),
    );
    expect(move?.type).toBe("play");
    if (move?.type === "play") expect(move.card.rank).toBe(10);
  });

  it("avoids leaving the count at 5 (gifting a fifteen to the opponent)", () => {
    // Count = 0; playing a 5 leaves count at 5 (dangerous — opponent has 10s).
    // Hard should prefer the 3 (count → 3) over the 5 (count → 5).
    const move = hardAIMove(
      baseView({
        phase: "play",
        myIndex: 0,
        nextPlayer: 0,
        myHand: [card(5, "H"), card(3, "D")],
        playPile: [],
        runningCount: 0,
      }),
    );
    expect(move?.type).toBe("play");
    if (move?.type === "play") expect(move.card.rank).toBe(3);
  });

  it("says go when no card is playable", () => {
    const move = hardAIMove(
      baseView({
        phase: "play",
        myIndex: 0,
        nextPlayer: 0,
        myHand: [card(10, "H"), card(13, "D")],
        runningCount: 22,
      }),
    );
    expect(move).toEqual({ type: "go" });
  });
});

// Hard AI outperforms Easy — head-to-head simulation

describe("Hard AI vs Easy AI — head-to-head", () => {
  it("Hard AI wins significantly more than half of games against Easy AI", () => {
    const numGames = 30;
    let hardWins = 0;

    for (let g = 0; g < numGames; g++) {
      // Alternate who is player 0 / 1 to cancel first-mover advantage
      const hardIsP0 = g % 2 === 0;
      const finalState = playGame(
        hardIsP0 ? (v) => hardAIMove(v) : (v) => easyAIMove(v),
        hardIsP0 ? (v) => easyAIMove(v) : (v) => hardAIMove(v),
      );

      if (finalState.winner !== null) {
        const hardIndex = hardIsP0 ? 0 : 1;
        if (finalState.winner === hardIndex) hardWins++;
      }
    }

    // Hard should win at least 60 % of games (well above chance, below perfection)
    expect(hardWins).toBeGreaterThanOrEqual(Math.floor(numGames * 0.6));
  }, 30_000); // generous timeout for 30 full game simulations
});
