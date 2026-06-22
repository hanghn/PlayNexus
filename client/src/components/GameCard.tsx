import "./GameCard.css";
import type { GameInfo, GameKey } from "@gamenite/shared";
import { NavLink } from "react-router-dom";
import { gameNames } from "../util/consts.ts";
import useTimeSince from "../hooks/useTimeSince.ts";
import cribbageArt from "../assets/cribbage.png";
import nimArt from "../assets/nim.png";
import guessArt from "../assets/num_guesser.png";

/** Per-game cover gradient + box art. */
const gameCover: Record<GameKey, { from: string; to: string; art: string }> = {
  cribbage: { from: "#6d9b9d", to: "#3d8988ce", art: cribbageArt },
  nim: { from: "#9592d9", to: "#5b5385", art: nimArt },
  guess: { from: "#cf9370", to: "#6a4d48", art: guessArt },
};

const statusLabel: Record<GameInfo["status"], string> = {
  waiting: "Waiting",
  active: "Live",
  done: "Finished",
};

/**
 * A single game rendered as a cover card for the home lobby grid.
 *
 * Keeps the same accessibility contract as the older list view: the card is a
 * `listitem` containing the creator, and a link whose accessible name is
 * "A game of <type>", so the existing game-list e2e flows keep working.
 */
export default function GameCard({
  gameId,
  type,
  status,
  players,
  createdAt,
  createdBy,
}: GameInfo) {
  const timeSince = useTimeSince();
  const cover = gameCover[type];
  const numPlayers = players.length;

  return (
    <div className="game-card" role="listitem">
      <NavLink
        to={`/game/${gameId}`}
        className="game-card-link"
        aria-label={`A game of ${gameNames[type]}`}
      >
        <div
          className="game-card-cover"
          style={{ background: `linear-gradient(160deg, ${cover.from}, ${cover.to})` }}
        >
          <img src={cover.art} alt="" className="game-card-art" />
          <span className={`game-card-pill pill-${status}`}>{statusLabel[status]}</span>
        </div>
        <div className="game-card-body">
          <div className="game-card-title">{gameNames[type]}</div>
          <div className="game-card-meta">
            {createdBy.display} · {timeSince(createdAt)}
          </div>
          <div className="game-card-players">
            {numPlayers} player{numPlayers === 1 ? "" : "s"}
          </div>
        </div>
      </NavLink>
    </div>
  );
}
