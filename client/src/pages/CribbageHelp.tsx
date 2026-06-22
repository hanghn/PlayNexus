import { Link } from "react-router-dom";
import "./CribbageHelp.css";

/**
 * Player-facing "How to play Cribbage" help page (route: /help/cribbage).
 * Adapted from the team's Cribbage rules spec into a friendlier reference, with
 * the in-app AI difficulties and keyboard controls added.
 */
export default function CribbageHelp() {
  return (
    <div className="cribhelp">
      <article className="cribhelp-card">
        <header className="cribhelp-head">
          <h1 className="cribhelp-title">How to play Cribbage</h1>
          <p className="cribhelp-lead">
            Cribbage is a card game where you score points by making combinations that add to 15,
            pairs, runs, and flushes. <strong>First player to 121 points wins.</strong>
          </p>
          <Link to="/games" className="cribhelp-back">
            ← Back to Games
          </Link>
        </header>

        <section aria-labelledby="flow">
          <h2 id="flow">A hand, step by step</h2>
          <ol className="cribhelp-flow">
            <li>
              <strong>Deal.</strong> Each player gets 6 cards.
            </li>
            <li>
              <strong>Discard.</strong> Each player sends 2 cards to the <em>crib</em> (a bonus hand
              that belongs to the dealer).
            </li>
            <li>
              <strong>Cut the starter.</strong> A shared card is turned up. If it's a Jack, the
              dealer scores 2 right away (&ldquo;his heels&rdquo;).
            </li>
            <li>
              <strong>The Play (pegging).</strong> Take turns laying down cards and scoring as the
              running count climbs — without going over 31.
            </li>
            <li>
              <strong>The Show.</strong> Count your hand, then the dealer's hand, then the crib.
            </li>
            <li>
              <strong>Next hand.</strong> The deal alternates, and you keep going until someone hits
              121.
            </li>
          </ol>
        </section>

        <section aria-labelledby="values">
          <h2 id="values">Card values</h2>
          <p>
            Face cards (J, Q, K) and 10 all count as <strong>10</strong>; the Ace is always{" "}
            <strong>low (1)</strong>. Two traps to remember:
          </p>
          <ul>
            <li>
              Q + K is <strong>not</strong> a pair — pairs need the same <em>rank</em>, not the same
              value.
            </li>
            <li>
              Runs don't wrap around: K-A-2 is <strong>not</strong> a run.
            </li>
          </ul>
        </section>

        <section aria-labelledby="play-scoring">
          <h2 id="play-scoring">Scoring during the Play (pegging)</h2>
          <table className="cribhelp-table">
            <thead>
              <tr>
                <th scope="col">Combination</th>
                <th scope="col">Points</th>
                <th scope="col">When</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Fifteen</td>
                <td>2</td>
                <td>Running count reaches 15</td>
              </tr>
              <tr>
                <td>Thirty-one</td>
                <td>2</td>
                <td>Running count reaches 31</td>
              </tr>
              <tr>
                <td>Pair</td>
                <td>2</td>
                <td>Same rank as the previous card</td>
              </tr>
              <tr>
                <td>Three / four of a kind</td>
                <td>6 / 12</td>
                <td>Same rank as the last 2 / 3 cards</td>
              </tr>
              <tr>
                <td>Run of 3+</td>
                <td>1 per card</td>
                <td>The last few cards form a sequence (in any order)</td>
              </tr>
              <tr>
                <td>Go / last card</td>
                <td>1</td>
                <td>You play the last legal card and the count is under 31</td>
              </tr>
            </tbody>
          </table>
          <p className="cribhelp-note">
            If you can't play without going over 31, say &ldquo;Go.&rdquo; One card can score
            several ways at once.
          </p>
        </section>

        <section aria-labelledby="show-scoring">
          <h2 id="show-scoring">Scoring in the Show</h2>
          <table className="cribhelp-table">
            <thead>
              <tr>
                <th scope="col">Combination</th>
                <th scope="col">Points</th>
                <th scope="col">Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Fifteen</td>
                <td>2 per combo</td>
                <td>Every set of cards adding to 15 — cards can be reused</td>
              </tr>
              <tr>
                <td>Pair / three / four of a kind</td>
                <td>2 / 6 / 12</td>
                <td>Same as in the Play</td>
              </tr>
              <tr>
                <td>Run of 3+</td>
                <td>1 per card</td>
                <td>Double runs score both runs and the pair</td>
              </tr>
              <tr>
                <td>Flush</td>
                <td>4 or 5</td>
                <td>All 4 hand cards same suit (5 if the starter matches)</td>
              </tr>
              <tr>
                <td>His nobs</td>
                <td>1</td>
                <td>A Jack in your hand matching the starter's suit</td>
              </tr>
            </tbody>
          </table>
          <p className="cribhelp-note">
            <strong>The perfect hand:</strong> 5♣ 5♦ 5♠ J♥ with a 5♥ starter scores{" "}
            <strong>29</strong> — the highest possible (sixteen from fifteens, twelve for four 5s,
            one for his nobs).
          </p>
        </section>

        <section aria-labelledby="ai">
          <h2 id="ai">Playing the computer: Easy vs Hard</h2>
          <div className="cribhelp-ai">
            <div className="cribhelp-ai-card">
              <h3>Easy</h3>
              <p>
                Plays mostly at random, which is good for learning the flow without pressure. It
                will grab an obvious 31 or 15 when one's available, but it won't plan its discards.
              </p>
            </div>
            <div className="cribhelp-ai-card">
              <h3>Hard</h3>
              <p>
                Plays to score. It discards to keep the best expected hand (and weighs whether the
                crib is its own), and during pegging it plays the highest-scoring card while
                avoiding counts of 5 and 21, where you could easily answer with a 10-value card.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="keys">
          <h2 id="keys">Keyboard controls</h2>
          <p>You can play entirely by keyboard:</p>
          <ul className="cribhelp-keys">
            <li>
              <kbd>←</kbd> <kbd>→</kbd> — move between your cards (or the cut deck)
            </li>
            <li>
              <kbd>Space</kbd> — pick a card (when choosing what to send to the crib)
            </li>
            <li>
              <kbd>Enter</kbd> — confirm: cut, send to crib, or play the focused card
            </li>
            <li>
              <kbd>G</kbd> — say &ldquo;Go&rdquo; when you can't play
            </li>
            <li>
              <kbd>R</kbd> — ready up to start the hand
            </li>
          </ul>
        </section>
      </article>
    </div>
  );
}
