import "./GameRow.css";
import type { GameInfo, GameKey } from "@gamenite/shared";
import { NavLink } from "react-router-dom";
import { gameNames } from "../util/consts.ts";
import useTimeSince from "../hooks/useTimeSince.ts";
import cribbageArt from "../assets/cribbage.png";
import nimArt from "../assets/nim.png";
import guessArt from "../assets/num_guesser.png";

/** Per-game thumbnail gradient + box art (mirrors GameCard). */
const gameCover: Record<GameKey, { from: string; to: string; art: string }> = {
  cribbage: { from: "#6d9b9d", to: "#3d8988", art: cribbageArt },
  nim: { from: "#9592d9", to: "#5b5385", art: nimArt },
  guess: { from: "#cf9370", to: "#6a4d48", art: guessArt },
};

const statusLabel: Record<GameInfo["status"], string> = {
  waiting: "Waiting",
  active: "Live",
  done: "Finished",
};

/**
 * A single game rendered as a scannable list row. Keeps the same accessibility
 * contract as the older summary view: a `listitem` containing a link whose
 * accessible name is "A game of <type>".
 */
export default function GameRow({ gameId, type, status, players, createdAt, createdBy }: GameInfo) {
  const timeSince = useTimeSince();
  const cover = gameCover[type];
  const numPlayers = players.length;

  return (
    <div className="game-row" role="listitem">
      <NavLink
        to={`/game/${gameId}`}
        className="game-row-link"
        aria-label={`A game of ${gameNames[type]}`}
      >
        <span
          className="game-row-thumb"
          style={{ background: `linear-gradient(160deg, ${cover.from}, ${cover.to})` }}
          aria-hidden="true"
        >
          <img src={cover.art} alt="" className="game-row-art" />
        </span>
        <span className="game-row-main">
          <span className="game-row-title">{gameNames[type]}</span>
          <span className="game-row-meta">
            {createdBy.display} · {timeSince(createdAt)}
          </span>
        </span>
        <span className="game-row-right">
          {status !== "done" && (
            <span className="game-row-players">
              {numPlayers} player{numPlayers === 1 ? "" : "s"}
            </span>
          )}
          <span className={`game-row-pill game-row-pill--${status}`}>{statusLabel[status]}</span>
        </span>
      </NavLink>
    </div>
  );
}
