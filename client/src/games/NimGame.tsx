import type { NimMove, NimView } from "@gamenite/shared";
import type { GameProps } from "../util/types.ts";
import { useEffect, useRef } from "react";
import GameResult from "../components/GameResult.tsx";
import useKeyboardNav from "../hooks/useKeyboardNav.ts";
import { announce } from "../lib/liveAnnounce.ts";
import "./NimGame.css";

export default function NimGame({
  view,
  players,
  userPlayerIndex,
  makeMove,
}: GameProps<NimView, NimMove>) {
  const disabled = userPlayerIndex !== view.nextPlayer;

  function playerDisplay(index: number) {
    return index === userPlayerIndex ? "you" : players[index].display;
  }
  function playerPoss(index: number) {
    return index === userPlayerIndex ? "your" : `${players[index].display}'s`;
  }

  const isWinner = view.remaining === 0 && userPlayerIndex === view.nextPlayer;

  // Announce turn changes for screen-reader users (pairs with the visual cue).
  const wasMyTurn = useRef(false);
  useEffect(() => {
    const myTurn = !disabled && view.remaining > 0;
    if (myTurn && !wasMyTurn.current) announce("Your turn.");
    wasMyTurn.current = myTurn;
  }, [disabled, view.remaining]);

  // Keyboard: 1/2/3 take that many objects, only when it's your turn
  useKeyboardNav(
    {
      ["1"]: () => {
        if (!disabled && view.remaining >= 1) makeMove(1);
      },
      ["2"]: () => {
        if (!disabled && view.remaining >= 2) makeMove(2);
      },
      ["3"]: () => {
        if (!disabled && view.remaining >= 3) makeMove(3);
      },
    },
    view.remaining > 0,
  );

  return (
    <div className="nim">
      <header className="nim-hero">
        <p className="nim-sub">
          Take 1 to 3 objects each turn. Whoever takes the <strong>last</strong> object loses.
        </p>
      </header>

      {/* Visual pile */}
      <div className="nim-pile-card">
        <div
          className="nim-pile"
          role="img"
          aria-label={`${view.remaining} object${view.remaining === 1 ? "" : "s"} left`}
        >
          {Array.from({ length: view.remaining }, (_, i) => (
            <span key={i} className="nim-token" />
          ))}
          {view.remaining === 0 && <span className="nim-empty">Pile empty</span>}
        </div>
        <div className="nim-count">
          {view.remaining} left
          {view.remaining > 0 && (
            <span className="nim-turn">
              {disabled ? `${playerPoss(view.nextPlayer)} turn` : "your turn"}
            </span>
          )}
        </div>
      </div>

      {!disabled && view.remaining > 0 && (
        <p className="sr-only" aria-live="polite">
          Press 1, 2, or 3 to take that many objects.
        </p>
      )}

      {view.remaining === 0 && (
        <GameResult
          isWinner={isWinner}
          message={`The game is over: ${
            isWinner ? "you" : playerDisplay(view.nextPlayer)
          } won by forcing ${playerDisplay(1 - view.nextPlayer)} to take the last object.`}
        />
      )}

      {userPlayerIndex >= 0 && view.remaining > 0 && (
        <>
          <div className="nim-actions" role="group" aria-label="Take objects">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                className="accentBtn accentBtn--green nim-take"
                disabled={disabled || view.remaining < n}
                onClick={() => makeMove(n)}
                aria-keyshortcuts={`${n}`}
              >
                Take {n} <kbd>{n}</kbd>
              </button>
            ))}
          </div>
          <p className="nim-tip">Tip: press 1, 2, or 3 to take objects.</p>
        </>
      )}
    </div>
  );
}
