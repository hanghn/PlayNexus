import "./GamePanel.css";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { GameInfo } from "@gamenite/shared";
import { gameNames } from "../util/consts.ts";
import useLoginContext from "../hooks/useLoginContext.ts";
import GameDispatch from "../games/GameDispatch.tsx";
import useSocketsForGame from "../hooks/useSocketsForGame.ts";
import useTimeSince from "../hooks/useTimeSince.ts";

/** How many times the auto-join silently retries before showing a manual button. */
const MAX_JOIN_TRIES = 3;

/**
 * A game panel allows viewing the status and players of a live game
 */
export default function GamePanel({
  gameId,
  type,
  players: initialPlayers,
  createdAt,
  minPlayers,
}: GameInfo) {
  const { user } = useLoginContext();
  const timeSince = useTimeSince();
  const location = useLocation();
  const navigate = useNavigate();

  const {
    view,
    players,
    userPlayerIndex,
    hasWatched,
    gameError,
    notice,
    joinGame,
    leaveGame,
    startGame,
  } = useSocketsForGame(gameId, initialPlayers);

  const handleLeave = () => {
    leaveGame();
    void navigate("/games");
  };

  // When arriving from an accepted invite, join automatically so the recipient
  // lands straight in the lobby as a player without a manual click.
  const autoJoin = (location.state as { autoJoin?: boolean } | null)?.autoJoin === true;
  const autoJoinedRef = useRef(false);
  const [joinAttempted, setJoinAttempted] = useState(false);
  const [joinTries, setJoinTries] = useState(0);
  useEffect(() => {
    if (autoJoin && hasWatched && !autoJoinedRef.current && userPlayerIndex < 0 && !view) {
      autoJoinedRef.current = true;
      setJoinAttempted(true);
      joinGame();
    }
  }, [autoJoin, hasWatched, userPlayerIndex, view, joinGame]);

  // Quietly retry the auto-join a few times (covers transient races: socket not
  // fully connected, watch not yet acknowledged) before silently falling back to
  // a manual "Join Game" button. No error message — just keep trying.
  useEffect(() => {
    if (!joinAttempted || userPlayerIndex >= 0 || gameError || joinTries >= MAX_JOIN_TRIES) return;
    const timer = setTimeout(() => {
      joinGame();
      setJoinTries((n) => n + 1);
    }, 2500);
    return () => clearTimeout(timer);
  }, [joinAttempted, userPlayerIndex, gameError, joinTries, joinGame]);

  // "Joining…" shows while the auto-join is still being attempted.
  const joining = joinAttempted && userPlayerIndex < 0 && !gameError && joinTries < MAX_JOIN_TRIES;

  return hasWatched ? (
    <div className="gamePanel">
      <div className="gameWindow">
        <div className={`gameRoster${view ? " gameRosterLive" : ""}`}>
          {/* Header: game name + room age, with a status pill showing whether the
            game is live (a board is being viewed) or still gathering players */}
          <div className="gameRosterTop">
            <div className="gameRosterHeadings">
              <h2 className="gameRosterTitle">{gameNames[type]}</h2>
              <div className="gameRosterMeta">Room created {timeSince(createdAt)}</div>
            </div>
          </div>

          {/* Chips + action buttons. When a game is live this lays out on a
              single compact row (chips then Leave); in the lobby it stacks. */}
          <div className="gameRosterControls">
            {/* One chip per player; the current user's chip is highlighted. The
              live / lobby status pill sits at the right end of this row. */}
            <div className="playerChips" role="list" aria-label="Players in this game">
              {players.map((player, index) => {
                const isYou = player.username === user.username;
                return (
                  <div
                    className={`playerChip${isYou ? " isYou" : ""}`}
                    role="listitem"
                    key={player.username}
                  >
                    <span className="playerChipBadge">{index + 1}</span>
                    <span className="playerChipName">
                      {isYou
                        ? `you are player #${index + 1}`
                        : `Player #${index + 1} is ${player.display}`}
                    </span>
                  </div>
                );
              })}
            </div>

            {
              // If the game hasn't started and user hasn't joined, they can join.
              // After an accepted invite this happens automatically (a disabled
              // "Joining…" shows while it's in flight).
              userPlayerIndex < 0 &&
                !view &&
                (joining ? (
                  <button className="gameActionBtn" disabled>
                    Joining…
                  </button>
                ) : (
                  <button className="gameActionBtn" onClick={joinGame}>
                    Join Game
                  </button>
                ))
            }
            {gameError && (
              <p className="gameJoinError" role="alert">
                {gameError}
              </p>
            )}
            {
              // If the game hasn't started and the user has joined, they can start the game if a minimum number of players are present
              userPlayerIndex >= 0 && !view && players.length >= minPlayers && (
                <button className="gameActionBtn" onClick={startGame}>
                  Start Game
                </button>
              )
            }
            {
              // A joined player can leave at any time: a not-started lobby just
              // removes them; an in-progress game is abandoned (marked over).
              userPlayerIndex >= 0 && (
                <button className="gameLeaveBtn" onClick={handleLeave}>
                  {view ? "Leave / Abandon game" : "Leave Game"}
                </button>
              )
            }
            {notice && <p className="gameNotice">{notice}</p>}
          </div>
        </div>
        {/* Once the game is live, render the game-specific board; otherwise show a
          waiting placeholder until enough players join and someone starts it */}
        {view ? (
          <div className="gameFrame">
            <GameDispatch
              gameId={gameId}
              userPlayerIndex={userPlayerIndex}
              players={players}
              view={view}
            />
          </div>
        ) : (
          <div className="gameFrame waiting">
            <div className="waitingInner">
              <span className="waitingDots">
                <i />
                <i />
                <i />
              </span>
              <p className="waitingTitle">waiting for game to begin</p>
              <p className="waitingMeta">
                {players.length} of {minPlayers} player{minPlayers === 1 ? "" : "s"} needed to start
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  ) : (
    <div></div>
  );
}
