import { z } from "zod";

/**
 * Cribbage is a two-player card game with hidden information (each player's
 * hand, and the dealer's "crib"). The full state lives on the server; each
 * player receives a CribbageView that hides cards they shouldn't see.
 *
 * Rules reference: docs/cribbage-rules.md
 */

// ---------------------------------- Cards ----------------------------------

/** A card's suit: "H" = Hearts, "D" = Diamonds, "C" = Clubs, "S" = Spades. */
export const zSuit = z.union([z.literal("H"), z.literal("D"), z.literal("C"), z.literal("S")]);
export type Suit = z.infer<typeof zSuit>;

/** A card's rank: 1 = Ace, 11 = Jack, 12 = Queen, 13 = King. */
export const zRank = z.int().gte(1).lte(13);
export type Rank = z.infer<typeof zRank>;

/** A single playing card. */
export const zCard = z.object({ rank: zRank, suit: zSuit });
export type Card = z.infer<typeof zCard>;

/** A card's count value during pegging (face cards = 10, Ace = 1). */
export function cardValue(rank: Rank): number {
  return Math.min(rank, 10);
}

// ---------------------------------- Phases & AI difficulty ----------------------------------

/**
 * The phases of a cribbage game, in order:
 * - cut: at the very start, each player cuts a card from the deck; the lower
 *   card decides who deals first (and therefore takes the first crib)
 * - deal: cards have just been dealt; each player sees their hand and confirms
 *   they are ready before discarding begins
 * - discard: each player chooses 2 cards to send to the dealer's crib
 * - play: players alternate playing cards (pegging)
 * - show: hands and crib are scored
 * - handover: a hand just finished (nobody reached 121); the players choose to
 *   deal the next hand and play on, or quit and end the game here
 * - done: game over (a player reached 121, or a player quit)
 */
export type CribbagePhase = "cut" | "deal" | "discard" | "play" | "show" | "handover" | "done";

/** AI opponent difficulty for solo-player games (used by the AI move-selector). */
export type CribbageDifficulty = "easy" | "hard";

/**
 * An AI opponent's decision function: given only the view that player can see
 * (hidden info already stripped by viewAs) plus a difficulty, return a legal move.
 *
 * Contract: the returned move is fed through the SAME update() validation as a
 * human move, so the AI can never do anything a human couldn't.
 *
 * Fallback: the selector must ALWAYS return a legal move. If a heuristic cannot
 * decide, or would pick an illegal move, it falls back to a safe default: any
 * legal discard, the lowest legal card to play, or "go" when nothing is
 * playable. This guarantees the game never stalls.
 */
export type CribbageMoveSelector = (
  view: CribbageView,
  difficulty: CribbageDifficulty,
) => CribbageMove;

// ---------------------------------- Scoring breakdown ----------------------------------

/** Point categories */
export const zCribbageScoreCategory = z.enum([
  "fifteen",
  "pair",
  "pairRoyal", // three of a kind
  "doublePairRoyal", // four of a kind
  "run",
  "flush",
  "nob", // Jack in hand matching the starter's suit
  "heels", // Jack cut as the starter (dealer +2)
  "go",
  "thirtyOne",
  "lastCard",
]);

export type CribbageScoreCategory = z.infer<typeof zCribbageScoreCategory>;

/** One scoring event, used to render a per-hand breakdown of how points were awarded. */
export interface ScoreEvent {
  player: 0 | 1;
  category: CribbageScoreCategory;
  points: number;
  source: "play" | "show" | "crib" | "cut"; // where the points came from
  details?: string; // optional human-readable note
  cards?: Card[]; // the specific cards that produced the score (for highlighting)
}

// ------------------------ Full server-side state (hidden info intact) ------------------------

/**
 * Complete game state kept on the server (never sent to clients directly).
 * - phase: current stage of the hand
 * - dealer: index of the dealer for this hand (alternates each hand)
 * - deck: undealt cards and cut the starter / deal the next hand from here
 * - hands: the viewer's own 4-cards (empty for a watcher) they can hold after discarding
 * - crib: 4 cards discarded to the dealer's crib
 * - starter: the cut card revealed after discarding (null until cut)
 * - playPile: cards played in the current pegging round (resets after 31 / Go)
 * - played: all cards each player has already pegged this hand
 * - runningCount: current pegging count for the active round (0-31)
 * - goFlags: whether each player has said "Go" in the current round
 * - scores: cumulative points for each player
 * - nextPlayer: whose turn it is
 * - log: scoring events this hand (for the breakdown)
 * - winner: first player to reach 121 (null until the game ends)
 */
export interface CribbageState {
  phase: CribbagePhase;
  dealer: 0 | 1;
  deck: Card[];
  hands: [Card[], Card[]];
  crib: Card[];
  starter: Card | null;
  playPile: Card[];
  played: [Card[], Card[]];
  runningCount: number;
  goFlags: [boolean, boolean];
  /** Tracks which players have clicked "Ready" during the deal phase. */
  readyFlags: [boolean, boolean];
  /**
   * Each player's chosen card during the opening "cut" phase (null until they
   * pick). Carried into the first deal so the result can be shown, then null.
   */
  cutCards: [Card | null, Card | null];
  scores: [number, number];
  nextPlayer: 0 | 1;
  log: ScoreEvent[];
  winner: 0 | 1 | null;
}

// -------------- Per-player view (opponent hand & crib hidden until the show) --------------

/**
 * What a player (or watcher, myIndex === -1) can see.
 * - phase / dealer / nextPlayer / runningCount / playPile / starter / scores: public info
 * - myIndex: 0 or 1 for players, -1 for watchers
 * - myHand: the player's own cards
 * - opponentHand: the opponent's cards, revealed during show/done (null otherwise)
 * - opponentHandSize: count of the opponent's cards (for display during play)
 * - crib: null during discard/play; revealed to both players during show
 * - cribSize:  number of cards in the crib
 * - starter: null until the cut
 * - playPile: cards played in the current pegging round
 * - runningCount: current pegging count
 * - scores: [player0Score, player1Score]
 * - nextPlayer: whose turn it is
 * - log: the score breakdown
 * - winner: player who reached 121 (null until the game ends)
 */
export interface CribbageView {
  phase: CribbagePhase;
  dealer: 0 | 1;
  myIndex: number;
  myHand: Card[];
  opponentHand: Card[] | null; // we want to reveal this during show
  opponentHandSize: number;
  crib: Card[] | null;
  cribSize: number;
  starter: Card | null;
  playPile: Card[];
  runningCount: number;
  scores: [number, number];
  nextPlayer: 0 | 1;
  /** Whether this player has clicked "Ready" in the deal phase. */
  myReady: boolean;
  /** Whether the opponent has clicked "Ready" in the deal phase. */
  opponentReady: boolean;
  /** Cut phase: how many face-down cards remain to cut from. */
  cutDeckSize: number;
  /** The card this player cut (revealed only to them, null until they pick). */
  myCut: Card | null;
  /** The opponent's cut card — hidden during the cut, revealed once resolved. */
  opponentCut: Card | null;
  /** Cut phase: whether the opponent has already cut (no card leaked). */
  opponentHasCut: boolean;
  log: ScoreEvent[];
  winner: 0 | 1 | null;
}

// ------------------------ Moves ------------------------

/** Discard phase: send exactly 2 cards to the crib. */
export const zDiscardMove = z.object({
  type: z.literal("discard"),
  cards: z.tuple([zCard, zCard]),
});
export type DiscardMove = z.infer<typeof zDiscardMove>;

/** Play phase: play one card from your hand. */
export const zPlayCardMove = z.object({
  type: z.literal("play"),
  card: zCard,
});
export type PlayCardMove = z.infer<typeof zPlayCardMove>;

/** Play phase: declare you cannot play without exceeding 31. */
export const zGoMove = z.object({ type: z.literal("go") });
export type GoMove = z.infer<typeof zGoMove>;

/** Deal phase: player confirms they have seen their hand and are ready to discard. */
export const zReadyMove = z.object({ type: z.literal("ready") });
export type ReadyMove = z.infer<typeof zReadyMove>;

/** Cut phase: pick the card at this position in the (face-down) deck. */
export const zCutMove = z.object({ type: z.literal("cut"), index: z.int().gte(0) });
export type CutMove = z.infer<typeof zCutMove>;

/** Handover phase: deal the next hand and keep playing toward 121. */
export const zContinueMove = z.object({ type: z.literal("continue") });
export type ContinueMove = z.infer<typeof zContinueMove>;

/** Handover phase: stop here and end the game (the current leader wins). */
export const zQuitMove = z.object({ type: z.literal("quit") });
export type QuitMove = z.infer<typeof zQuitMove>;

/** Any valid move a player can submit. */
export const zCribbageMove = z.union([
  zReadyMove,
  zCutMove,
  zDiscardMove,
  zPlayCardMove,
  zGoMove,
  zContinueMove,
  zQuitMove,
]);
export type CribbageMove = z.infer<typeof zCribbageMove>;
