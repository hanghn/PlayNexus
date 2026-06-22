# Cribbage Rules & Scoring Specification

This document contains the engineering specification of Cribbage rules and
scoring for implementation in the PlayNexus (prev. GameNite) codebase.
Reference document for cribbage.types.ts, scoring engine, and game loop.

Source: [cardgames.io rules](https://cardgames.io/cribbage/#rules),
[six-card cribbage](https://www.pagat.com/adders/crib6.html).

## **1. The Deck and Card Values**

Standard 52-card deck: 4 suits × 13 ranks.

Suits: ♥️ Hearts ♦️ Diamonds ♣ Clubs ♠ Spades Ranks: A 2 3 4 5 6 7 8 9 10 J Q
K  
Count: 1 2 3 4 5 6 7 8 9 10 10 10 10 ← for running count in Play  
Run: 1 2 3 4 5 6 7 8 9 10 11 12 13 ← for sequences

**Two rule traps to avoid:**

- Q + K are NOT a pair even though both count as 10. Pairs require same rank,
  not same value.

- Ace is always low for runs. K-A-2 is NOT a run and sequences don’t wrap.

## **2. Game Flow (Per Hand)**

Deal 6 Cards → Discard 2 to Crib → Cut Start → Play Peg → Show Score → Next
Hand

- **Dealer** alternates each hand. First hand: low cut decides.

- **Win:** first player to 121 points and game ends _immediately_, mid-show
  counts.

- **His heels:** if starter is a Jack, then dealer scores 2 pts immediately at
  cut.

- **Crib** belongs to dealer (scored after both hands in Show).

## **3. The Play Phase (Pegging)**

Pone (i.e., the non-dealer) leads. Players alternate playing one card,
announcing running count. Count cannot exceed 31. If a player can’t play
without busting → say “Go”. The opponent continues until they also can’t.
Reset count, opposite player leads next round.

### **Play-Phase Scoring**

| **Event**                       | **Points** | **When**                                              |
| ------------------------------- | ---------- | ----------------------------------------------------- |
| Fifteen                         | 2          | Running count = 15                                    |
| Thirty-one                      | 2          | Running count = 31 (overrides “Go”)                   |
| Pair                            | 2          | Same rank as previous card                            |
| Pair royal (3-of-a-kind)        | 6          | Same rank as previous 2 cards                         |
| Double pair royal (4-of-a-kind) | 12         | Same rank as previous 3 cards                         |
| Run of 3+                       | 1 per card | Last N cards reorderable into a sequence with no gaps |
| Go / last card                  | 1          | You play the last legal card and count \< 31          |

Notes: One play can score multiple ways.

Example: opponent plays A♦️, you play 7♣, opponent plays 7 ♥️ → opponent
scores “15 for 4” = 2 (fifteen: 1+7+7) + 2 (pair of 7s).

Run example: Played in order 5♠, 7♦️, 6♣ → This is a run of 3 (cards reorder
to 5-6-7). Played 5, 7, 7, 6 → NOT a run (extra 7 breaks sequence).

## **4. The Show Phase**

Score in this order (game can end mid-show and the opponent doesn’t get to
count):

1. The non-dealer’s hand (4 cards + starter)
2. Dealer’s hand (4 cards + starter)
3. Dealer’s crib (4 cards + starter)

### **Show-Phase Scoring**

| **Event**                             | **Points**  | **Notes**                                                                                 |
| ------------------------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| Fifteen                               | 2 per combo | Every subset summing to 15. Cards re-used across combos.                                  |
| Pair / Pair royal / Double pair royal | 2 / 6 / 12  | Same as Play                                                                              |
| Run of 3+                             | 1 per card  | Double runs (3-3-4-5) score both runs (3+3) + the pair (2) = 8                            |
| Flush — 4 cards                       | 4           | All 4 hand cards same suit. NOT valid in crib.                                            |
| Flush — 5 cards                       | 5           | All 4 hand + starter same suit. Crib requires all 5 same suit; partial flush in crib = 0. |
| His nob                               | 1           | A Jack in your hand matching the starter's suit                                           |

### Example:

Hand: 5♣ 5♦️ 5♠ J♥️ Starter: 5♥️

**Fifteens (16 pts):**

Four ways to combine J + one 5: J+5♣, J+5♦️, J+5♠, J+5♥️ = 4 × 2 = **8**

Four ways to combine three 5s: choosing any 3 of the four 5s, each summing to
15: C(4,3) = 4 × 2 = **8**

Total fifteens: **16**

**Four-of-a-kind (5♣ + 5♦️ + 5♠ + 5♥️): 12**

**His nob:** J♥️ matches starter suit ♥️ → **1**

**Total: 29 points** (the maximum possible)
