import "./CreateGameMenu.css";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { GameKey } from "@gamenite/shared";
import useAuth from "../hooks/useAuth.ts";
import useLoginContext from "../hooks/useLoginContext.ts";
import useFriends from "../hooks/useFriends.ts";
import { createGame, sendGameInvite } from "../services/gameService.ts";
import { gameNames } from "../util/consts.ts";

/**
 * "Create New Game" dropdown. Picking any game opens a small popup to choose the
 * mode: invite a specific friend or open a table anyone can join (plus vs Easy /
 * Hard AI for Cribbage). Replaces the old dedicated /game/new page.
 */
export default function CreateGameMenu({ triggerClassName }: { triggerClassName?: string }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const { user } = useLoginContext();
  const { friendships } = useFriends();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingGame, setPendingGame] = useState<GameKey | null>(null);
  const [modalView, setModalView] = useState<"mode" | "friends">("mode");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Accepted friends, resolved to the "other" user in each friendship.
  const friends = (friendships ?? [])
    .filter((f) => f.status === "accepted")
    .map((f) => (f.from.username === user.username ? f.to : f.from));

  const closeModal = () => {
    setPendingGame(null);
    setModalView("mode");
  };

  const start = async (gameKey: GameKey, singlePlayer = false, difficulty?: "easy" | "hard") => {
    setBusy(true);
    setError(null);
    try {
      const game = await createGame(auth, gameKey, singlePlayer, difficulty);
      await navigate(`/game/${game.gameId}`);
    } catch (err) {
      // Keep the popup open and show why (e.g. the one-game-at-a-time rule).
      setBusy(false);
      setError(err instanceof Error ? err.message : "Could not create the game.");
    }
  };

  // Create a multiplayer game of the pending type and invite a specific friend.
  const inviteFriend = async (username: string) => {
    if (!pendingGame) return;
    setBusy(true);
    setError(null);
    try {
      const game = await createGame(auth, pendingGame, false);
      await sendGameInvite(auth, username, game.gameId);
      await navigate(`/game/${game.gameId}`);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Could not create the game.");
    }
  };

  const pickGame = (key: GameKey) => {
    setMenuOpen(false);
    setModalView("mode");
    setError(null);
    setPendingGame(key);
  };

  return (
    <div className="create-game">
      <button
        type="button"
        className={triggerClassName}
        aria-label="Create New Game"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        disabled={busy}
        onClick={() => setMenuOpen((o) => !o)}
      >
        + Create New Game ▾
      </button>

      {menuOpen && (
        <>
          <div className="create-game-backdrop" onClick={() => setMenuOpen(false)} />
          <ul className="create-game-menu" role="menu">
            {(Object.keys(gameNames) as GameKey[]).map((key) => (
              <li key={key} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="create-game-item"
                  onClick={() => pickGame(key)}
                >
                  {gameNames[key]}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {pendingGame && (
        <div
          className="create-game-overlay"
          onClick={() => {
            if (!busy) closeModal();
          }}
        >
          <div className="create-game-modal" onClick={(e) => e.stopPropagation()}>
            {modalView === "mode" ? (
              <>
                <h3 className="create-game-modal-title">Start a {gameNames[pendingGame]} game</h3>
                <p className="create-game-modal-sub">
                  {pendingGame === "cribbage"
                    ? "Play against the computer, or play with a friend."
                    : "Invite a friend, or open a table anyone can join."}
                </p>
                {pendingGame === "cribbage" && (
                  <Link to="/help/cribbage" className="create-game-help-link">
                    New to Cribbage? How to play →
                  </Link>
                )}
                <div className="create-game-modal-actions">
                  {pendingGame === "cribbage" && (
                    <>
                      <button
                        type="button"
                        className="create-game-choice"
                        disabled={busy}
                        onClick={() => start("cribbage", true, "easy")}
                      >
                        vs Easy AI
                      </button>
                      <button
                        type="button"
                        className="create-game-choice"
                        disabled={busy}
                        onClick={() => start("cribbage", true, "hard")}
                      >
                        vs Hard AI
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="create-game-choice create-game-choice--alt"
                    disabled={busy}
                    onClick={() => setModalView("friends")}
                  >
                    Invite a friend
                  </button>
                  <button
                    type="button"
                    className="create-game-choice create-game-choice--alt"
                    disabled={busy}
                    onClick={() => start(pendingGame, false)}
                  >
                    Open table (anyone can join)
                  </button>
                </div>
                {error && <p className="create-game-error">{error}</p>}
                <button
                  type="button"
                  className="create-game-cancel"
                  disabled={busy}
                  onClick={closeModal}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <h3 className="create-game-modal-title">Invite a friend</h3>
                <p className="create-game-modal-sub">
                  Pick a friend to invite to a game of {gameNames[pendingGame]}.
                </p>
                {friends.length === 0 ? (
                  <p className="create-game-empty">
                    No friends yet — add some on the Friends page first.
                  </p>
                ) : (
                  <ul className="create-game-friends">
                    {friends.map((friend) => (
                      <li key={friend.username}>
                        <button
                          type="button"
                          className="create-game-friend"
                          disabled={busy}
                          onClick={() => inviteFriend(friend.username)}
                        >
                          <span className="create-game-friend-name">{friend.display}</span>
                          <span className="create-game-friend-handle">@{friend.username}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {error && <p className="create-game-error">{error}</p>}
                <button
                  type="button"
                  className="create-game-cancel"
                  disabled={busy}
                  onClick={() => setModalView("mode")}
                >
                  ← Back
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
