import { cardValue, type Card, type CribbageScoreCategory } from "@gamenite/shared";

/** A single scoring award before it's attributed to a player/source. */
export type ScoreDelta = {
  category: CribbageScoreCategory;
  points: number;
  details?: string;
  /** The specific cards that produced this score, for client highlighting. */
  cards?: Card[];
};

const SUITS = ["H", "D", "C", "S"] as const;

/** Build a fresh, ordered 52-card deck. */
export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank = rank + 1) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/** Returns a freshly-randomized copy of the deck, using the standard fair shuffle. */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); // random index in 0..i
    [a[i], a[j]] = [a[j], a[i]]; // swap a[i] and a[j]
  }
  return a;
}

/** Two cards are the same physical card iff rank and suit match. */
export function sameCard(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

/**
 * Score the points earned by the card just added to the pegging pile.
 * Looks only at the current round's pile and the running count.
 */
export function scorePegging(playPile: Card[], runningCount: number): ScoreDelta[] {
  const events: ScoreDelta[] = [];
  const last = playPile[playPile.length - 1];
  if (!last) return events;
  if (runningCount === 15)
    events.push({ category: "fifteen", points: 2, details: "fifteen", cards: [...playPile] });
  if (runningCount === 31)
    events.push({ category: "thirtyOne", points: 2, details: "thirty-one", cards: [...playPile] });

  // Pairs: trailing cards of the same rank as the card just played.
  let sameRankCount = 0;
  for (let i = playPile.length - 1; i >= 0; i = i - 1) {
    if (playPile[i].rank === last.rank) sameRankCount = sameRankCount + 1;
    else break;
  }
  const pairCards = playPile.slice(playPile.length - sameRankCount);
  if (sameRankCount === 2)
    events.push({ category: "pair", points: 2, details: "pair", cards: pairCards });
  else if (sameRankCount === 3)
    events.push({ category: "pairRoyal", points: 6, details: "three of a kind", cards: pairCards });
  else if (sameRankCount === 4)
    events.push({
      category: "doublePairRoyal",
      points: 12,
      details: "four of a kind",
      cards: pairCards,
    });

  // Runs: the longest run (>=3) formed by the most recent cards of the pile.
  for (let runLength = playPile.length; runLength >= 3; runLength = runLength - 1) {
    const recent = playPile.slice(playPile.length - runLength);
    const recentRanks = recent.map((card) => card.rank);
    const uniqueRanks = new Set(recentRanks);
    const isConsecutive =
      uniqueRanks.size === runLength &&
      Math.max(...recentRanks) - Math.min(...recentRanks) === runLength - 1;
    if (isConsecutive) {
      events.push({
        category: "run",
        points: runLength,
        details: `run of ${runLength}`,
        cards: recent,
      });
      break;
    }
  }
  return events;
}

/** Count every distinct subset of `cards` whose count-values sum to 15. */
function countFifteens(cards: Card[]): number {
  const values = cards.map((card) => cardValue(card.rank));
  const cardCount = cards.length;
  let combos = 0;

  // Check every possible combination of cards; count the ones summing to 15.
  // subset < 1 << cardCount keeps the loop running until it has checked all
  // 2^cardCount possible card combinations; 1 through 31 for a 5-card hand
  for (let subset = 1; subset < 1 << cardCount; subset++) {
    let sum = 0;
    for (let index = 0; index < cardCount; index = index + 1) {
      if (subset & (1 << index)) sum = values[index] + sum;
    }
    if (sum === 15) combos++;
  }
  return combos;
}

/** Count unordered pairs of cards with equal rank. */
function countPairs(cards: Card[]): number {
  let pairs = 0;
  for (let first = 0; first < cards.length; first++) {
    for (let second = first + 1; second < cards.length; second++) {
      if (cards[first].rank === cards[second].rank) pairs++;
    }
  }
  return pairs;
}

/** Run points, handling double/triple runs via rank multiplicities. */
function scoreRuns(cards: Card[]): number {
  // How many cards we hold of each rank (e.g. two 5s -> {5: 2}).
  const countByRank = new Map<number, number>();
  for (const card of cards) {
    countByRank.set(card.rank, (countByRank.get(card.rank) ?? 0) + 1);
  }
  const sortedRanks = [...countByRank.keys()].sort((rankA, rankB) => rankA - rankB);
  let total = 0;
  let start = 0;
  while (start < sortedRanks.length) {
    // Extend [start..end] as long as the ranks stay consecutive (no gaps)
    let end = start;
    while (end + 1 < sortedRanks.length && sortedRanks[end + 1] === sortedRanks[end] + 1) {
      end = end + 1;
    }

    const runLength = end - start + 1;
    if (runLength >= 3) {
      // Multiply by how many of each rank we have, so double/triple runs score fully.
      let multiplier = 1;
      for (let index = start; index <= end; index++) {
        multiplier = multiplier * (countByRank.get(sortedRanks[index]) ?? 1);
      }
      total += runLength * multiplier;
    }
    start = end + 1;
  }
  return total;
}

/** Cards belonging to a rank held more than once (the cards forming pairs). */
function pairedCards(cards: Card[]): Card[] {
  const countByRank = new Map<number, number>();
  for (const card of cards) countByRank.set(card.rank, (countByRank.get(card.rank) ?? 0) + 1);
  return cards.filter((card) => (countByRank.get(card.rank) ?? 0) > 1);
}

/** Cards whose rank participates in a run of 3+ consecutive ranks. */
function runMemberCards(cards: Card[]): Card[] {
  const countByRank = new Map<number, number>();
  for (const card of cards) countByRank.set(card.rank, (countByRank.get(card.rank) ?? 0) + 1);
  const sortedRanks = [...countByRank.keys()].sort((rankA, rankB) => rankA - rankB);
  const runRanks = new Set<number>();
  let start = 0;
  while (start < sortedRanks.length) {
    let end = start;
    while (end + 1 < sortedRanks.length && sortedRanks[end + 1] === sortedRanks[end] + 1) end++;
    if (end - start + 1 >= 3) {
      for (let index = start; index <= end; index++) runRanks.add(sortedRanks[index]);
    }
    start = end + 1;
  }
  return cards.filter((card) => runRanks.has(card.rank));
}

/**
 * Score a 4-card hand (or crib) with the starter, during the Show.
 * `isCrib` enforces the crib's stricter 5-card-only flush rule.
 */
export function scoreShow(hand: Card[], starter: Card, isCrib: boolean): ScoreDelta[] {
  const cards = [...hand, starter];
  const events: ScoreDelta[] = [];

  const fifteens = countFifteens(cards);
  if (fifteens > 0)
    events.push({
      category: "fifteen",
      points: fifteens * 2,
      details: `${fifteens} fifteen(s)`,
      cards: [...cards],
    });

  const pairs = countPairs(cards);
  if (pairs > 0)
    events.push({
      category: "pair",
      points: pairs * 2,
      details: `${pairs} pair(s)`,
      cards: pairedCards(cards),
    });

  const runs = scoreRuns(cards);
  if (runs > 0)
    events.push({ category: "run", points: runs, details: "runs", cards: runMemberCards(cards) });

  // Flush: 4 hand cards same suit (5 with starter). Crib needs all 5.
  const suit = hand[0]?.suit;
  const handFlush =
    hand.length === 4 && suit !== undefined && hand.every((card) => card.suit === suit);
  if (handFlush) {
    if (starter.suit === suit)
      events.push({ category: "flush", points: 5, details: "5-card flush", cards: [...cards] });
    else if (!isCrib)
      events.push({ category: "flush", points: 4, details: "4-card flush", cards: [...hand] });
  }

  // His nob: a Jack in hand matching the starter's suit.
  const nob = hand.find((card) => card.rank === 11 && card.suit === starter.suit);
  if (nob) {
    events.push({ category: "nob", points: 1, details: "his nob", cards: [nob, starter] });
  }
  return events;
}
