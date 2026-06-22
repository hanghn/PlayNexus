import {
  type CribbageState,
  type CribbageView,
  type Card,
  type ScoreEvent,
  cardValue,
  zCribbageMove,
} from "@gamenite/shared";
import { GameService } from "./gameServiceManager.ts";
import { type GameLogic } from "./gameLogic.ts";
import {
  buildDeck,
  shuffle,
  sameCard,
  scorePegging,
  scoreShow,
  type ScoreDelta,
} from "./cribbageScoring.ts";

/** The other player's index. */
const otherPlayer = (p: 0 | 1): 0 | 1 => (p === 0 ? 1 : 0);

/** Deal a fresh hand: 6 cards each, the rest reserved for the cut. */
function dealNewHand(dealer: 0 | 1, scores: [number, number], log: ScoreEvent[]): CribbageState {
  const deck = shuffle(buildDeck());
  return {
    phase: "deal",
    dealer,
    deck: deck.slice(12),
    hands: [deck.slice(0, 6), deck.slice(6, 12)],
    crib: [],
    starter: null,
    playPile: [],
    played: [[], []],
    runningCount: 0,
    goFlags: [false, false],
    readyFlags: [false, false],
    cutCards: [null, null],
    scores: [...scores] as [number, number],
    nextPlayer: otherPlayer(dealer), // pone (non-dealer) leads
    log: [...log],
    winner: null,
  };
}

/** The opening "cut for deal": a full shuffled deck, nobody has cut yet. */
function initialCut(): CribbageState {
  return {
    phase: "cut",
    dealer: 0, // placeholder until the cut resolves
    deck: shuffle(buildDeck()),
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

/** Shallow-clone the parts of state we mutate (cards themselves never change). */
function clone(s: CribbageState): CribbageState {
  return {
    ...s,
    deck: [...s.deck],
    hands: [[...s.hands[0]], [...s.hands[1]]],
    crib: [...s.crib],
    playPile: [...s.playPile],
    played: [[...s.played[0]], [...s.played[1]]],
    goFlags: [...s.goFlags] as [boolean, boolean],
    readyFlags: [...s.readyFlags] as [boolean, boolean],
    cutCards: [...s.cutCards] as [Card | null, Card | null],
    scores: [...s.scores] as [number, number],
    log: [...s.log],
  };
}

/** Add score deltas to a player's total and append them to the log. */
function award(
  state: CribbageState,
  player: 0 | 1,
  deltas: ScoreDelta[],
  source: ScoreEvent["source"],
): void {
  for (const delta of deltas) {
    state.scores[player] += delta.points;
    state.log.push({
      player,
      category: delta.category,
      points: delta.points,
      source,
      details: delta.details,
      cards: delta.cards,
    });
  }
}

/** End the game immediately if someone has reached 121. */
function checkWin(state: CribbageState): boolean {
  for (const player of [0, 1] as const) {
    if (state.scores[player] >= 121) {
      state.winner = player;
      state.phase = "done";
      return true;
    }
  }
  return false;
}

/** True if `hand` contains the given card (matched by rank + suit). */
const handHas = (hand: Card[], card: Card): boolean => hand.some((c) => sameCard(c, card));

/** Return a new hand with the first copy of `card` removed (original left unchanged). */
function removeCard(hand: Card[], card: Card): Card[] {
  const index = hand.findIndex((c) => sameCard(c, card));
  return index < 0 ? hand : [...hand.slice(0, index), ...hand.slice(index + 1)];
}

/** True if the hand has any card that can be played without pushing the count over 31. */
const canPlay = (hand: Card[], count: number): boolean =>
  hand.some((card) => cardValue(card.rank) <= 31 - count);

/** True once both players have played all their cards (the hand's pegging is over). */
const bothEmpty = (s: CribbageState): boolean => s.hands[0].length === 0 && s.hands[1].length === 0;

/** Which player played the card currently on top of the pile. */
function lastToPlay(s: CribbageState): 0 | 1 {
  const last = s.playPile[s.playPile.length - 1];
  return s.played[0].some((c) => sameCard(c, last)) ? 0 : 1;
}

/** Start a new pegging round: clear the pile and count, reset "go" flags, set who leads. */
function resetRound(s: CribbageState, leader: 0 | 1): void {
  s.playPile = [];
  s.runningCount = 0;
  s.goFlags = [false, false];
  s.nextPlayer = leader;
}

/** Score the Show (pone hand, dealer hand, dealer crib) and end the hand. */
function runShow(state: CribbageState): void {
  const starter = state.starter;
  if (!starter) return;
  const pone = otherPlayer(state.dealer);

  award(state, pone, scoreShow(state.played[pone], starter, false), "show");
  if (checkWin(state)) return;
  award(state, state.dealer, scoreShow(state.played[state.dealer], starter, false), "show");
  if (checkWin(state)) return;
  award(state, state.dealer, scoreShow(state.crib, starter, true), "crib");
  if (checkWin(state)) return;

  // The hand is complete and nobody has reached 121. Pause in "handover" so the
  // score breakdown can be shown and the players can choose to deal the next
  // hand (play on toward 121) or quit and end the game here.
  state.phase = "handover";
}

/** Handover: deal the next hand, alternating the dealer, and play on. */
function applyContinue(state: CribbageState): CribbageState | null {
  if (state.phase !== "handover") return null;
  // Fresh log so each hand's breakdown and real-time callouts stand alone.
  return dealNewHand(otherPlayer(state.dealer), state.scores, []);
}

/** Handover: end the game now; the higher score wins (ties leave no winner). */
function applyQuit(state: CribbageState): CribbageState | null {
  if (state.phase !== "handover") return null;
  const s = clone(state);
  s.phase = "done";
  s.winner = s.scores[0] === s.scores[1] ? null : s.scores[0] > s.scores[1] ? 0 : 1;
  return s;
}

/**
 * Cut phase: a player cuts the card at `index` of the (face-down) deck. Once
 * both have cut, the lower card decides the dealer (and so the first crib) and
 * the first hand is dealt. Equal ranks force a fresh re-cut.
 */
function applyCut(state: CribbageState, index: number, pi: 0 | 1): CribbageState | null {
  if (state.phase !== "cut") return null;
  if (state.cutCards[pi] !== null) return null; // already cut
  if (index < 0 || index >= state.deck.length) return null;

  const s = clone(state);
  const card = s.deck[index];
  s.cutCards[pi] = card;
  s.deck = [...s.deck.slice(0, index), ...s.deck.slice(index + 1)];

  const [c0, c1] = s.cutCards;
  if (c0 && c1) {
    if (c0.rank === c1.rank) {
      // Tie — shuffle a fresh deck and cut again.
      s.cutCards = [null, null];
      s.deck = shuffle(buildDeck());
      return s;
    }
    const dealer: 0 | 1 = c0.rank < c1.rank ? 0 : 1; // lower card deals
    const dealt = dealNewHand(dealer, s.scores, s.log);
    dealt.cutCards = [c0, c1]; // carry the result into the deal for the reveal
    return dealt;
  }
  return s;
}

/** Deal phase: a player confirms they are ready to start discarding. */
function applyReady(state: CribbageState, pi: 0 | 1): CribbageState | null {
  if (state.readyFlags[pi]) return null; // already clicked ready
  const s = clone(state);
  s.readyFlags[pi] = true;
  // Advance to discard once both players are ready
  if (s.readyFlags[0] && s.readyFlags[1]) {
    s.phase = "discard";
  }
  return s;
}

/** Discard phase: a player sends exactly 2 cards to the crib. */
function applyDiscard(state: CribbageState, cards: [Card, Card], pi: 0 | 1): CribbageState | null {
  if (state.hands[pi].length !== 6) return null; // already discarded
  const [first, second] = cards;
  if (sameCard(first, second)) return null;
  if (!handHas(state.hands[pi], first) || !handHas(state.hands[pi], second)) return null;

  const s = clone(state);
  s.hands[pi] = removeCard(removeCard(s.hands[pi], first), second);
  s.crib = [...s.crib, first, second];

  // Once both players have discarded, cut the starter and begin the Play phase.
  if (s.hands[0].length === 4 && s.hands[1].length === 4) {
    const starter = s.deck[0];
    s.starter = starter;
    s.deck = s.deck.slice(1);
    s.phase = "play";
    s.playPile = [];
    s.played = [[], []];
    s.runningCount = 0;
    s.goFlags = [false, false];
    s.nextPlayer = otherPlayer(s.dealer);
    if (starter.rank === 11) {
      award(
        s,
        s.dealer,
        [{ category: "heels", points: 2, details: "his heels", cards: [starter] }],
        "cut",
      );
      checkWin(s);
    }
  }
  return s;
}

/** Play phase: a player pegs one card. */
function applyPlay(state: CribbageState, card: Card, pi: 0 | 1): CribbageState | null {
  if (pi !== state.nextPlayer) return null;
  if (!handHas(state.hands[pi], card)) return null;
  const value = cardValue(card.rank);
  if (state.runningCount + value > 31) return null;

  const s = clone(state);
  s.hands[pi] = removeCard(s.hands[pi], card);
  s.played[pi] = [...s.played[pi], card];
  s.playPile = [...s.playPile, card];
  s.runningCount += value;
  award(s, pi, scorePegging(s.playPile, s.runningCount), "play");
  if (checkWin(s)) return s;

  if (s.runningCount === 31) {
    if (bothEmpty(s)) runShow(s);
    else resetRound(s, otherPlayer(pi));
    return s;
  }
  if (bothEmpty(s)) {
    award(s, pi, [{ category: "lastCard", points: 1, details: "last card" }], "play");
    if (!checkWin(s)) runShow(s);
    return s;
  }
  // Opponent plays next, unless they've already gone — then this player continues.
  const opp = otherPlayer(pi);
  s.nextPlayer = s.goFlags[opp] ? pi : opp;
  return s;
}

/** Play phase: a player declares "go" (cannot play without exceeding 31). */
function applyGo(state: CribbageState, pi: 0 | 1): CribbageState | null {
  if (pi !== state.nextPlayer) return null;
  if (canPlay(state.hands[pi], state.runningCount)) return null; // must play if able

  const s = clone(state);
  s.goFlags[pi] = true;
  const opp = otherPlayer(pi);

  if (s.goFlags[opp]) {
    // Both players are stuck: the last to play scores 1 for the go, then reset.
    let leader = opp;
    if (s.playPile.length > 0) {
      const lp = lastToPlay(s);
      leader = otherPlayer(lp);
      if (s.runningCount < 31) {
        award(s, lp, [{ category: "go", points: 1, details: "go" }], "play");
        if (checkWin(s)) return s;
      }
    }
    if (bothEmpty(s)) runShow(s);
    else resetRound(s, leader);
    return s;
  }

  s.nextPlayer = opp; // opponent still has cards to play
  return s;
}

/** Build the per-player view, hiding cards the viewer shouldn't see. */
function buildView(state: CribbageState, playerIndex: number): CribbageView {
  const isPlayer = playerIndex === 0 || playerIndex === 1;
  const reveal = state.phase === "show" || state.phase === "handover" || state.phase === "done";
  const me = isPlayer ? playerIndex : 0;
  const opp = otherPlayer(me);

  let myHand: Card[] = [];
  let opponentHand: Card[] | null = null;
  let opponentHandSize = 0;

  if (isPlayer) {
    if (reveal) {
      // At the Show, both players' four cards are revealed.
      myHand = state.played[me];
      opponentHand = state.played[opp];
      opponentHandSize = state.played[opp].length;
    } else {
      myHand = state.hands[me];
      opponentHandSize = state.hands[opp].length;
    }
  } else if (reveal) {
    // Watchers see both hands once revealed.
    myHand = state.played[0];
    opponentHand = state.played[1];
    opponentHandSize = state.played[1].length;
  }

  const myReady = isPlayer ? state.readyFlags[playerIndex] : false;
  const oppReady = isPlayer ? state.readyFlags[otherPlayer(playerIndex)] : false;

  // Cut info: a player sees their own cut; the opponent's is hidden during the
  // cut itself, then revealed once it has resolved (phase has left "cut").
  const myCut = isPlayer ? state.cutCards[me] : null;
  const cutResolved = state.phase !== "cut";
  const opponentCut = isPlayer && cutResolved ? state.cutCards[opp] : null;
  const opponentHasCut = isPlayer ? state.cutCards[opp] !== null : false;

  return {
    phase: state.phase,
    dealer: state.dealer,
    myIndex: isPlayer ? playerIndex : -1,
    myHand,
    opponentHand,
    opponentHandSize,
    crib: reveal ? state.crib : null,
    cribSize: state.crib.length,
    starter: state.starter,
    playPile: state.playPile,
    runningCount: state.runningCount,
    scores: state.scores,
    nextPlayer: state.nextPlayer,
    myReady,
    opponentReady: oppReady,
    cutDeckSize: state.deck.length,
    myCut,
    opponentCut,
    opponentHasCut,
    log: state.log,
    winner: state.winner,
  };
}

export const cribbageLogic: GameLogic<CribbageState, CribbageView> = {
  minPlayers: 2,
  maxPlayers: 2,
  start: () => initialCut(),
  update: (state, payload, playerIndex) => {
    if (state.phase === "done" || state.phase === "show") return null;
    if (playerIndex !== 0 && playerIndex !== 1) return null;
    const parsed = zCribbageMove.safeParse(payload);
    if (parsed.error) return null;
    const move = parsed.data;
    const pi = playerIndex;

    if (state.phase === "cut") {
      return move.type === "cut" ? applyCut(state, move.index, pi) : null;
    }
    if (state.phase === "deal") {
      return move.type === "ready" ? applyReady(state, pi) : null;
    }
    if (state.phase === "discard") {
      return move.type === "discard" ? applyDiscard(state, move.cards, pi) : null;
    }
    if (state.phase === "handover") {
      if (move.type === "continue") return applyContinue(state);
      if (move.type === "quit") return applyQuit(state);
      return null;
    }
    if (move.type === "play") return applyPlay(state, move.card, pi);
    if (move.type === "go") return applyGo(state, pi);
    return null;
  },
  isDone: (state) => state.phase === "done",
  viewAs: (state, playerIndex) => buildView(state, playerIndex),
  tagView: (view) => ({ type: "cribbage", view }),
};

export const cribbageGameService = new GameService<CribbageState, CribbageView>(cribbageLogic);
