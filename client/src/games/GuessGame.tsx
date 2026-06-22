import type { GuessMove, GuessView } from "@gamenite/shared";
import type { GameProps } from "../util/types.ts";
import { useState } from "react";
import GameResult from "../components/GameResult.tsx";
import useKeyboardNav from "../hooks/useKeyboardNav.ts";
import "./GuessGame.css";

export default function GuessGame({
  view,
  players,
  userPlayerIndex,
  makeMove,
}: GameProps<GuessView, GuessMove>) {
  const [guess, setGuess] = useState(16);
  const playerHasGuessed = view.finished || view.guesses[userPlayerIndex] !== false;

  // Keyboard navigation: arrow keys to adjust, Enter to submit
  useKeyboardNav(
    {
      ["ArrowUp"]: () => setGuess((g) => Math.min(100, g + 1)),
      ["ArrowDown"]: () => setGuess((g) => Math.max(1, g - 1)),
      ["ArrowLeft"]: () => setGuess((g) => Math.max(1, g - 1)),
      ["ArrowRight"]: () => setGuess((g) => Math.min(100, g + 1)),
      ["Enter"]: () => {
        // If a button/link has focus (Submit, Hide chat, Leave…), activate it —
        // the window-level Enter binding would otherwise swallow it.
        const focused = document.activeElement as HTMLElement | null;
        if (focused && (focused.tagName === "BUTTON" || focused.tagName === "A")) {
          focused.click();
          return;
        }
        if (!playerHasGuessed && userPlayerIndex >= 0) {
          makeMove(guess);
        }
      },
    },
    !playerHasGuessed && userPlayerIndex >= 0,
  );

  /** Checks if a guess is the best guess */
  function isBestGuess(index: number) {
    if (!view.finished) return false;
    const g = view.guesses[index];
    for (const otherGuess of view.guesses) {
      if (Math.abs(otherGuess - view.secret) < Math.abs(g - view.secret)) {
        return false;
      }
    }
    return true;
  }

  /** Get the response text for a specific player's guess */
  function getGuessText(g: boolean | number, index: number) {
    if (index === userPlayerIndex) {
      if (view.finished === true) return `You guessed ${g}`;
      return view.myGuess ? `You guessed ${view.myGuess}` : "You haven't guessed yet";
    }
    if (g === false) return `${players[index].display} hasn't guessed yet`;
    if (g === true) return `${players[index].display} has guessed`;
    return `${players[index].display} guessed ${g}`;
  }

  const resultMessage = view.finished
    ? (() => {
        const winners = view.guesses
          .map((_, i) =>
            isBestGuess(i) ? (i === userPlayerIndex ? "You" : players[i].display) : null,
          )
          .filter(Boolean)
          .join(", ");
        return `The secret was ${view.secret}. ${winners} won.`;
      })()
    : undefined;

  return (
    <div className="gg">
      <header className="gg-hero">
        <p className="gg-sub">Guess a number between 1 and 100. Closest wins!</p>
      </header>

      <ul className="gg-players">
        {view.guesses.map((g: number | boolean, index: number) => {
          const guessed = view.finished || g !== false;
          return (
            <li key={index} className={`gg-player${isBestGuess(index) ? " gg-player--win" : ""}`}>
              <span className={`gg-dot${guessed ? " is-done" : ""}`} aria-hidden="true" />
              <span className="gg-player-text">{getGuessText(g, index)}</span>
              {isBestGuess(index) && <span className="gg-crown">👑</span>}
            </li>
          );
        })}
      </ul>

      {view.finished && (
        <GameResult isWinner={isBestGuess(userPlayerIndex)} message={resultMessage} />
      )}

      {!view.finished &&
        userPlayerIndex >= 0 &&
        (playerHasGuessed ? (
          <p className="gg-waiting">Waiting for other players…</p>
        ) : (
          <form
            className="gg-form"
            onSubmit={(e) => {
              e.preventDefault();
              makeMove(guess);
            }}
          >
            <div className="gg-readout" aria-live="polite">
              {guess}
            </div>
            <label className="gg-slider-label" htmlFor="gg-range">
              Drag to choose, then submit
            </label>
            <input
              id="gg-range"
              className="gg-range"
              type="range"
              value={guess}
              min={1}
              max={100}
              step={1}
              aria-valuetext={`${guess}`}
              onChange={(e) => setGuess(parseInt(e.target.value))}
            />
            <button className="accentBtn accentBtn--blue gg-submit">Submit guess</button>
            <p className="gg-tip">Tip: use ← → or ↑ ↓ to adjust, Enter to submit.</p>
          </form>
        ))}
    </div>
  );
}
