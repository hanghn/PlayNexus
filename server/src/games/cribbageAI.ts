import { cardValue, type Card, type CribbageMove, type CribbageView } from "@gamenite/shared";
import { buildDeck, sameCard, scorePegging, scoreShow } from "./cribbageScoring.ts";

/**
 * Sentinel user ID used to represent an Easy AI player in the game's player list.
 * This ID is never stored in UserRepo and is handled specially wherever players
 * are populated (see game.service.ts).
 */
export const AI_EASY_PLAYER_ID = "__ai_easy__";

/**
 * Easy AI move selector.
 *
 * Intentionally simple — it only respects the rules with minimal heuristics:
 * - Deal phase:    immediately ready (no reason to wait)
 * - Discard phase: pick 2 random cards from the 6-card hand
 * - Play phase:    prefer a card that makes exactly 15 or 31 (light filtering),
 *                  otherwise pick a random legal card; say "go" when stuck
 *
 * Returns null when the AI has nothing to do this turn (e.g. it's the human's
 * turn, or the game is in show/done).
 */
export function easyAIMove(view: CribbageView): CribbageMove | null {
  // Cut for deal: wait for the human to cut first, then cut a random card so
  // the result resolves on the same turn.
  if (view.phase === "cut") {
    if (view.myCut || !view.opponentHasCut) return null;
    return { type: "cut", index: Math.floor(Math.random() * view.cutDeckSize) };
  }

  // Handover: the hand is over but nobody reached 121. Let the HUMAN decide
  // whether to deal the next hand or quit — the AI waits (returns null) so the
  // choice (and the score breakdown) stays in front of the player.
  if (view.phase === "handover") return null;

  // Deal: immediately signal ready
  if (view.phase === "deal") {
    return view.myReady ? null : { type: "ready" };
  }

  // Discard: randomly pick 2 cards from the 6-card hand
  if (view.phase === "discard" && view.myHand.length === 6) {
    const hand = [...view.myHand].sort(() => Math.random() - 0.5);
    return { type: "discard", cards: [hand[0], hand[1]] };
  }

  // Play: only act on the AI's turn
  if (view.phase === "play" && view.nextPlayer === view.myIndex) {
    const playable = view.myHand.filter((c) => cardValue(c.rank) <= 31 - view.runningCount);

    if (playable.length === 0) return { type: "go" };

    // Light filtering: prefer a card that makes exactly 31, then 15
    const makes31 = playable.filter((c) => view.runningCount + cardValue(c.rank) === 31);
    if (makes31.length > 0) return { type: "play", card: makes31[0] };

    const makes15 = playable.filter((c) => view.runningCount + cardValue(c.rank) === 15);
    if (makes15.length > 0) return { type: "play", card: makes15[0] };

    // Random otherwise
    const pick = playable[Math.floor(Math.random() * playable.length)];
    return { type: "play", card: pick };
  }

  return null; // Nothing for the AI to do right now
}

/**
 * Sentinel user ID representing the Hard AI in a game's player list. Like the
 * Easy sentinel, it is never stored in UserRepo and is handled specially where
 * players are populated (see game.service.ts).
 */
export const AI_HARD_PLAYER_ID = "__ai_hard__";

/** Total point value of a list of scoring deltas. */
const sumPoints = (deltas: { points: number }[]): number =>
  deltas.reduce((total, d) => total + d.points, 0);

/** Cards the AI can legally play without exceeding 31. */
const legalPlays = (view: CribbageView): Card[] =>
  view.myHand.filter((c) => cardValue(c.rank) <= 31 - view.runningCount);

/** A rough standalone value of the 2 cards we send to the crib. */
function cribValue(a: Card, b: Card): number {
  let v = 0;
  if (a.rank === b.rank) v += 2; // pair
  if (cardValue(a.rank) + cardValue(b.rank) === 15) v += 2; // fifteen
  if (a.rank === 5) v += 1; // fives are crib gold
  if (b.rank === 5) v += 1;
  if (a.rank === 11) v += 0.5; // jacks (nob potential)
  if (b.rank === 11) v += 0.5;
  return v;
}

/**
 * Discard the 2 cards that leave the best 4-card hand, scored as the EXPECTED
 * show value averaged over every possible starter (cards we can't see), and
 * adjusted for who gets the crib (keep crib value if dealer, shed it if pone).
 */
function chooseDiscard(view: CribbageView): CribbageMove {
  const hand = view.myHand;
  const deck = buildDeck();
  const unseen = deck.filter((c) => !hand.some((h) => sameCard(h, c))); // 46 cards
  const amDealer = view.dealer === view.myIndex;

  let best: { discard: [Card, Card]; score: number } | null = null;

  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      const discard: [Card, Card] = [hand[i], hand[j]];
      const keep = hand.filter((_, k) => k !== i && k !== j);

      let total = 0;
      for (const starter of unseen) {
        total += sumPoints(scoreShow(keep, starter, false));
      }
      const expectedHand = total / unseen.length;
      const crib = cribValue(discard[0], discard[1]);
      const score = expectedHand + (amDealer ? crib * 0.5 : -crib * 0.5);

      if (!best || score > best.score) best = { discard, score };
    }
  }

  return { type: "discard", cards: best!.discard };
}

/**
 * Play the card that scores the most right now, while avoiding leaving the
 * count at 5 or 21 (where the opponent's plentiful 10-value cards make 15/31).
 * Tie-break by shedding higher cards first to keep low cards for flexibility.
 */
function choosePlay(view: CribbageView): CribbageMove {
  const legal = legalPlays(view);
  if (legal.length === 0) return { type: "go" };

  const scored = legal.map((c) => {
    const count = view.runningCount + cardValue(c.rank);
    const points = sumPoints(scorePegging([...view.playPile, c], count));
    const danger = count === 5 || count === 21 ? 2 : 0;
    return { card: c, value: points - danger };
  });

  scored.sort((a, b) => b.value - a.value || cardValue(b.card.rank) - cardValue(a.card.rank));
  return { type: "play", card: scored[0].card };
}

/**
 * Hard AI move selector: scoring-aware discard and pegging. Cut and ready use
 * the same trivial logic as Easy (no real decision to make there).
 */
export function hardAIMove(view: CribbageView): CribbageMove | null {
  if (view.phase === "cut") {
    if (view.myCut || !view.opponentHasCut) return null;
    return { type: "cut", index: Math.floor(Math.random() * view.cutDeckSize) };
  }

  if (view.phase === "handover") return { type: "continue" };

  if (view.phase === "deal") return view.myReady ? null : { type: "ready" };

  if (view.phase === "discard" && view.myHand.length === 6) {
    return chooseDiscard(view);
  }

  if (view.phase === "play" && view.nextPlayer === view.myIndex) {
    return choosePlay(view);
  }

  return null;
}

/** Pick the move selector matching whichever AI sentinel is in the game. */
export function aiMoveFor(aiPlayerId: string, view: CribbageView): CribbageMove | null {
  return aiPlayerId === AI_HARD_PLAYER_ID ? hardAIMove(view) : easyAIMove(view);
}
