import { describe, expect, it } from "vitest";
import type { Card, CribbageState, CribbageView } from "@gamenite/shared";
import { cribbageLogic } from "../../src/games/cribbage.ts";
import {
  AI_HARD_PLAYER_ID,
  aiMoveFor,
  easyAIMove,
  hardAIMove,
} from "../../src/games/cribbageAI.ts";

/** Build a minimal cut-phase state with a known deck order. */
function cutState(deck: Card[]): CribbageState {
  return {
    phase: "cut",
    dealer: 0,
    deck,
    hands: [[], []],
    crib: [],
    starter: null,
    playPile: [],
    played: [[], []],
    runningCount: 0,
    goFlags: [false, false],
    readyFlags: [false, false],
    cutCards: [null, null],
    scores: [0, 0],
    nextPlayer: 0,
    log: [],
    winner: null,
  };
}

const card = (rank: number, suit: Card["suit"]): Card => ({ rank, suit });

describe("Cribbage cut-for-deal", () => {
  it("start() opens in the cut phase with a full deck and no cuts made", () => {
    const s = cribbageLogic.start(2);
    expect(s.phase).toBe("cut");
    expect(s.deck).toHaveLength(52);
    expect(s.cutCards).toEqual([null, null]);
  });

  it("records a player's cut and removes that card from the deck", () => {
    const s = cribbageLogic.update(
      cutState([card(5, "H"), card(9, "C")]),
      { type: "cut", index: 0 },
      0,
    );
    expect(s).not.toBeNull();
    expect(s!.phase).toBe("cut");
    expect(s!.cutCards[0]).toEqual(card(5, "H"));
    expect(s!.cutCards[1]).toBeNull();
    expect(s!.deck).toHaveLength(1);
  });

  it("rejects cutting twice or an out-of-range index", () => {
    const after0 = cribbageLogic.update(
      cutState([card(5, "H"), card(9, "C")]),
      { type: "cut", index: 0 },
      0,
    )!;
    expect(cribbageLogic.update(after0, { type: "cut", index: 0 }, 0)).toBeNull(); // already cut
    expect(cribbageLogic.update(after0, { type: "cut", index: 9 }, 1)).toBeNull(); // out of range
  });

  it("the lower card deals: player 0 cuts 5, player 1 cuts 9 → dealer 0", () => {
    const after0 = cribbageLogic.update(
      cutState([card(5, "H"), card(9, "C")]),
      { type: "cut", index: 0 },
      0,
    )!;
    const resolved = cribbageLogic.update(after0, { type: "cut", index: 0 }, 1)!;
    expect(resolved.phase).toBe("deal");
    expect(resolved.dealer).toBe(0);
    expect(resolved.cutCards).toEqual([card(5, "H"), card(9, "C")]); // carried for the reveal
    expect(resolved.hands[0]).toHaveLength(6);
  });

  it("the lower card deals: player 1 cuts lower → dealer 1", () => {
    const after0 = cribbageLogic.update(
      cutState([card(9, "C"), card(5, "H")]),
      { type: "cut", index: 0 },
      0,
    )!;
    const resolved = cribbageLogic.update(after0, { type: "cut", index: 0 }, 1)!;
    expect(resolved.phase).toBe("deal");
    expect(resolved.dealer).toBe(1);
  });

  it("equal ranks force a fresh re-cut", () => {
    const after0 = cribbageLogic.update(
      cutState([card(5, "H"), card(5, "S")]),
      { type: "cut", index: 0 },
      0,
    )!;
    const resolved = cribbageLogic.update(after0, { type: "cut", index: 0 }, 1)!;
    expect(resolved.phase).toBe("cut");
    expect(resolved.cutCards).toEqual([null, null]);
    expect(resolved.deck).toHaveLength(52);
  });

  it("a player's view hides the opponent's cut until it resolves", () => {
    const after0 = cribbageLogic.update(
      cutState([card(5, "H"), card(9, "C")]),
      { type: "cut", index: 0 },
      0,
    )!;
    const oppView: CribbageView = cribbageLogic.viewAs(after0, 1);
    expect(oppView.myCut).toBeNull();
    expect(oppView.opponentCut).toBeNull(); // hidden during the cut
    expect(oppView.opponentHasCut).toBe(true); // but they know a cut was made
    expect(oppView.cutDeckSize).toBe(1);
  });
});

describe("Easy AI cut behaviour", () => {
  const baseView: CribbageView = {
    phase: "cut",
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
    nextPlayer: 0,
    myReady: false,
    opponentReady: false,
    cutDeckSize: 10,
    myCut: null,
    opponentCut: null,
    opponentHasCut: false,
    log: [],
    winner: null,
  };

  it("waits until the opponent has cut", () => {
    expect(easyAIMove(baseView)).toBeNull();
  });

  it("cuts a legal in-range card once the opponent has cut", () => {
    const move = easyAIMove({ ...baseView, opponentHasCut: true });
    expect(move?.type).toBe("cut");
    if (move?.type === "cut") {
      expect(move.index).toBeGreaterThanOrEqual(0);
      expect(move.index).toBeLessThan(10);
    }
  });

  it("does not cut again once it has already cut", () => {
    expect(easyAIMove({ ...baseView, opponentHasCut: true, myCut: card(7, "D") })).toBeNull();
  });
});

/** A full CribbageView with sensible defaults, overridden per test. */
function view(partial: Partial<CribbageView>): CribbageView {
  return {
    phase: "discard",
    dealer: 0,
    myIndex: 1,
    myHand: [],
    opponentHand: null,
    opponentHandSize: 4,
    crib: null,
    cribSize: 0,
    starter: null,
    playPile: [],
    runningCount: 0,
    scores: [0, 0],
    nextPlayer: 1,
    myReady: false,
    opponentReady: false,
    cutDeckSize: 0,
    myCut: null,
    opponentCut: null,
    opponentHasCut: false,
    log: [],
    winner: null,
    ...partial,
  };
}

describe("Hard AI — discard", () => {
  it("keeps the four 5s (a 20-point hand) and discards the rest", () => {
    const hand = [
      card(5, "H"),
      card(5, "S"),
      card(5, "D"),
      card(5, "C"),
      card(10, "H"),
      card(2, "C"),
    ];
    const move = hardAIMove(view({ phase: "discard", myHand: hand, dealer: 1, myIndex: 1 }));
    expect(move?.type).toBe("discard");
    if (move?.type === "discard") {
      // It must keep all four 5s, so neither discarded card is a 5.
      expect(move.cards.every((c) => c.rank !== 5)).toBe(true);
    }
  });
});

describe("Hard AI — pegging", () => {
  it("plays the card that reaches exactly 31", () => {
    const hand = [card(6, "H"), card(4, "S")]; // count 25: 6 -> 31 (scores), 4 -> 29
    const move = hardAIMove(
      view({ phase: "play", myHand: hand, runningCount: 25, nextPlayer: 1, myIndex: 1 }),
    );
    expect(move?.type).toBe("play");
    if (move?.type === "play") expect(move.card.rank).toBe(6);
  });

  it("makes a pair when it can", () => {
    const hand = [card(7, "H"), card(9, "S")];
    const move = hardAIMove(
      view({
        phase: "play",
        myHand: hand,
        runningCount: 7,
        playPile: [card(7, "D")],
        nextPlayer: 1,
        myIndex: 1,
      }),
    );
    expect(move?.type).toBe("play");
    if (move?.type === "play") expect(move.card.rank).toBe(7); // 7+7 = pair for 2
  });

  it("says go when nothing is playable", () => {
    const hand = [card(13, "H")]; // King = 10, count 30 -> can't play
    const move = hardAIMove(
      view({ phase: "play", myHand: hand, runningCount: 30, nextPlayer: 1, myIndex: 1 }),
    );
    expect(move).toEqual({ type: "go" });
  });
});

describe("aiMoveFor", () => {
  it("routes the Hard sentinel to the Hard AI", () => {
    const hand = [
      card(5, "H"),
      card(5, "S"),
      card(5, "D"),
      card(5, "C"),
      card(10, "H"),
      card(2, "C"),
    ];
    const move = aiMoveFor(AI_HARD_PLAYER_ID, view({ phase: "discard", myHand: hand, myIndex: 1 }));
    expect(move?.type).toBe("discard");
    if (move?.type === "discard") expect(move.cards.every((c) => c.rank !== 5)).toBe(true);
  });
});

/** A full CribbageState with sensible defaults; override per phase under test. */
function flowState(overrides: Partial<CribbageState>): CribbageState {
  return {
    phase: "play",
    dealer: 0,
    deck: [card(2, "H"), card(3, "H"), card(4, "H")],
    hands: [[], []],
    crib: [],
    starter: card(7, "S"),
    playPile: [],
    played: [[], []],
    runningCount: 0,
    goFlags: [false, false],
    readyFlags: [false, false],
    cutCards: [null, null],
    scores: [0, 0],
    nextPlayer: 0,
    log: [],
    winner: null,
    ...overrides,
  };
}

const up = (state: CribbageState, move: unknown, pi: number) =>
  cribbageLogic.update(state, move, pi);

describe("Cribbage game flow", () => {
  it("ignores moves once the game is done or in the show phase", () => {
    expect(up(flowState({ phase: "done" }), { type: "go" }, 0)).toBeNull();
    expect(up(flowState({ phase: "show" }), { type: "go" }, 0)).toBeNull();
  });

  it("rejects a non-player index and a malformed move", () => {
    expect(up(flowState({}), { type: "go" }, 7)).toBeNull();
    expect(up(flowState({}), { nonsense: true }, 0)).toBeNull();
  });

  describe("deal phase", () => {
    it("advances to discard once both players ready up", () => {
      let s = up(flowState({ phase: "deal" }), { type: "ready" }, 0)!;
      expect(s.phase).toBe("deal");
      expect(s.readyFlags[0]).toBe(true);
      s = up(s, { type: "ready" }, 1)!;
      expect(s.phase).toBe("discard");
    });

    it("rejects readying twice and a wrong move type", () => {
      expect(
        up(flowState({ phase: "deal", readyFlags: [true, false] }), { type: "ready" }, 0),
      ).toBeNull();
      expect(up(flowState({ phase: "deal" }), { type: "go" }, 0)).toBeNull();
    });
  });

  describe("discard phase", () => {
    const handH: Card[] = [
      card(2, "H"),
      card(3, "H"),
      card(4, "H"),
      card(5, "H"),
      card(6, "H"),
      card(7, "H"),
    ];
    const handC: Card[] = [
      card(2, "C"),
      card(3, "C"),
      card(4, "C"),
      card(5, "C"),
      card(6, "C"),
      card(7, "C"),
    ];

    it("sends two cards to the crib", () => {
      const s = up(
        flowState({ phase: "discard", hands: [handH, handC] }),
        { type: "discard", cards: [card(2, "H"), card(3, "H")] },
        0,
      )!;
      expect(s.hands[0]).toHaveLength(4);
      expect(s.crib).toHaveLength(2);
    });

    it("cuts the starter to start play; a Jack starter scores his heels for the dealer", () => {
      let s = flowState({
        phase: "discard",
        dealer: 0,
        hands: [handH, handC],
        deck: [card(11, "D")],
      });
      s = up(s, { type: "discard", cards: [card(6, "H"), card(7, "H")] }, 0)!;
      s = up(s, { type: "discard", cards: [card(6, "C"), card(7, "C")] }, 1)!;
      expect(s.phase).toBe("play");
      expect(s.starter).toEqual(card(11, "D"));
      expect(s.scores[0]).toBe(2);
    });

    it("rejects an invalid discard (wrong hand size, duplicate, or card not held)", () => {
      expect(
        up(
          flowState({ phase: "discard", hands: [[card(2, "H")], []] }),
          {
            type: "discard",
            cards: [card(2, "H"), card(3, "H")],
          },
          0,
        ),
      ).toBeNull();
      expect(
        up(
          flowState({ phase: "discard", hands: [handH, handC] }),
          {
            type: "discard",
            cards: [card(2, "H"), card(2, "H")],
          },
          0,
        ),
      ).toBeNull();
      expect(
        up(
          flowState({ phase: "discard", hands: [handH, handC] }),
          {
            type: "discard",
            cards: [card(9, "S"), card(3, "H")],
          },
          0,
        ),
      ).toBeNull();
    });
  });

  describe("play phase", () => {
    it("pegs a card and passes the turn", () => {
      const s = up(
        flowState({ phase: "play", hands: [[card(4, "H")], [card(5, "C")]], nextPlayer: 0 }),
        { type: "play", card: card(4, "H") },
        0,
      )!;
      expect(s.runningCount).toBe(4);
      expect(s.nextPlayer).toBe(1);
    });

    it("rejects playing out of turn, a card not held, or one that would exceed 31", () => {
      const base = flowState({
        phase: "play",
        hands: [[card(4, "H")], [card(5, "C")]],
        nextPlayer: 0,
      });
      expect(up(base, { type: "play", card: card(4, "H") }, 1)).toBeNull();
      expect(up(base, { type: "play", card: card(9, "S") }, 0)).toBeNull();
      expect(
        up(
          flowState({
            phase: "play",
            hands: [[card(10, "H")], []],
            nextPlayer: 0,
            runningCount: 30,
          }),
          {
            type: "play",
            card: card(10, "H"),
          },
          0,
        ),
      ).toBeNull();
    });
  });

  describe("go", () => {
    it("rejects 'go' when the player can still play", () => {
      expect(
        up(
          flowState({ phase: "play", hands: [[card(2, "H")], []], nextPlayer: 0 }),
          { type: "go" },
          0,
        ),
      ).toBeNull();
    });

    it("records a go and passes the turn when the opponent can still play", () => {
      const s = up(
        flowState({
          phase: "play",
          hands: [[card(10, "H")], [card(2, "C")]],
          nextPlayer: 0,
          runningCount: 30,
        }),
        { type: "go" },
        0,
      )!;
      expect(s.goFlags[0]).toBe(true);
      expect(s.nextPlayer).toBe(1);
    });

    it("scores the go and resets when both players are stuck", () => {
      // p1 has already said go; p0 (who played last) also can't play → p0 takes the go point.
      const s = up(
        flowState({
          phase: "play",
          hands: [[card(10, "H")], []],
          nextPlayer: 0,
          runningCount: 25,
          goFlags: [false, true],
          playPile: [card(5, "S")],
          played: [[card(5, "S")], []],
        }),
        { type: "go" },
        0,
      )!;
      expect(s.scores[0]).toBeGreaterThanOrEqual(1);
    });
  });

  describe("handover", () => {
    it("continue deals a fresh hand", () => {
      expect(
        up(flowState({ phase: "handover", scores: [10, 8] }), { type: "continue" }, 0)?.phase,
      ).toBe("deal");
    });

    it("quit ends the game; the higher score wins, a tie leaves no winner", () => {
      expect(
        up(flowState({ phase: "handover", scores: [10, 8] }), { type: "quit" }, 0)?.winner,
      ).toBe(0);
      expect(
        up(flowState({ phase: "handover", scores: [8, 8] }), { type: "quit" }, 0)?.winner,
      ).toBeNull();
    });
  });

  describe("views", () => {
    it("builds a watcher view and a revealed view without throwing", () => {
      expect(cribbageLogic.viewAs(flowState({ phase: "play" }), -1)).toBeDefined();
      expect(
        cribbageLogic.viewAs(
          flowState({ phase: "handover", played: [[card(2, "H")], [card(3, "C")]] }),
          0,
        ),
      ).toBeDefined();
    });

    it("builds a watcher view during the reveal phase", () => {
      expect(
        cribbageLogic.viewAs(
          flowState({ phase: "handover", played: [[card(2, "H")], [card(3, "C")]] }),
          -1,
        ),
      ).toBeDefined();
    });
  });

  describe("moves that don't match the phase return null", () => {
    const hand6: Card[] = [
      card(2, "H"),
      card(3, "H"),
      card(4, "H"),
      card(5, "H"),
      card(6, "H"),
      card(7, "H"),
    ];
    it("ignores moves that don't belong to the current phase", () => {
      expect(up(flowState({ phase: "cut", deck: [card(2, "H")] }), { type: "go" }, 0)).toBeNull();
      expect(
        up(flowState({ phase: "discard", hands: [hand6, hand6.slice()] }), { type: "go" }, 0),
      ).toBeNull();
      expect(up(flowState({ phase: "handover" }), { type: "go" }, 0)).toBeNull();
      expect(up(flowState({ phase: "play" }), { type: "ready" }, 0)).toBeNull();
    });
  });
});

describe("Cribbage pegging — go and continue", () => {
  it("rejects a go from the player whose turn it isn't", () => {
    expect(up(flowState({ nextPlayer: 0 }), { type: "go" }, 1)).toBeNull();
  });

  it("keeps the turn with the same player when the opponent has already gone", () => {
    const s = flowState({
      nextPlayer: 0,
      hands: [[card(3, "H"), card(4, "H")], [card(5, "D")]],
      played: [[], [card(5, "S")]],
      playPile: [card(5, "S")],
      runningCount: 5,
      goFlags: [false, true],
    });
    const result = up(s, { type: "play", card: card(3, "H") }, 0)!;
    expect(result.nextPlayer).toBe(0);
  });

  it("scores the go and resets the round when both players are stuck", () => {
    const s = flowState({
      nextPlayer: 0,
      hands: [[card(10, "H")], [card(10, "D")]],
      played: [[card(5, "S")], [card(6, "C")]],
      playPile: [card(5, "S"), card(6, "C")],
      runningCount: 30,
      goFlags: [false, true],
    });
    const result = up(s, { type: "go" }, 0)!;
    expect(result.runningCount).toBe(0);
    expect(result.goFlags).toEqual([false, false]);
    // Player 1 played the last card, so they take the 1-point "go".
    expect(result.scores[1]).toBe(1);
  });

  it("ends the hand at the show when both players go with empty hands", () => {
    const s = flowState({
      nextPlayer: 0,
      hands: [[], []],
      played: [
        [card(5, "S"), card(6, "C"), card(7, "D"), card(8, "H")],
        [card(2, "S"), card(3, "C"), card(4, "D"), card(9, "H")],
      ],
      playPile: [card(9, "H")],
      runningCount: 9,
      goFlags: [false, true],
      starter: card(10, "S"),
    });
    expect(up(s, { type: "go" }, 0)!.phase).toBe("handover");
  });

  it("treats the show as a no-op when the starter is somehow missing", () => {
    const s = flowState({
      nextPlayer: 0,
      hands: [[], []],
      played: [[card(5, "S")], [card(9, "H")]],
      playPile: [card(9, "H")],
      runningCount: 9,
      goFlags: [false, true],
      starter: null,
    });
    expect(up(s, { type: "go" }, 0)).not.toBeNull();
  });
});

describe("Cribbage phase guards and endgame", () => {
  it("rejects continue, quit, and cut outside their valid phases", () => {
    expect(up(flowState({ phase: "play" }), { type: "continue" }, 0)).toBeNull();
    expect(up(flowState({ phase: "play" }), { type: "quit" }, 0)).toBeNull();
    expect(up(flowState({ phase: "play" }), { type: "cut", index: 0 }, 0)).toBeNull();
  });

  it("quitting at handover gives the win to the higher score, or none on a tie", () => {
    expect(
      up(flowState({ phase: "handover", scores: [80, 60] }), { type: "quit" }, 0)!.winner,
    ).toBe(0);
    expect(
      up(flowState({ phase: "handover", scores: [60, 80] }), { type: "quit" }, 0)!.winner,
    ).toBe(1);
    expect(
      up(flowState({ phase: "handover", scores: [70, 70] }), { type: "quit" }, 0)!.winner,
    ).toBeNull();
  });
});
