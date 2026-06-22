import "./GameInviteNotifications.css";
import useGameInvites from "../hooks/useGameInvites.ts";
import { gameNames } from "../util/consts.ts";

/**
 * Floating toasts for incoming game invitations. Mounted globally (in Layout)
 * so an invite pops up wherever the recipient happens to be. Accepting jumps
 * straight into the game's lobby and auto-joins.
 */
export default function GameInviteNotifications() {
  const { invites, declines, accept, decline, dismissDecline } = useGameInvites();

  if (invites.length === 0 && declines.length === 0) return null;

  return (
    <div className="game-invite-stack">
      {invites.map((invite) => (
        <div className="game-invite-toast" key={`${invite.gameId}-${invite.from.username}`}>
          <div className="game-invite-text">
            <strong>{invite.from.display}</strong> invited you to play{" "}
            {gameNames[invite.gameType] ?? invite.gameType}
          </div>
          <div className="game-invite-actions">
            <button type="button" className="game-invite-accept" onClick={() => accept(invite)}>
              Accept
            </button>
            <button type="button" className="game-invite-decline" onClick={() => decline(invite)}>
              Decline
            </button>
          </div>
        </div>
      ))}

      {/* Decline notices shown to the inviter, so they can invite someone else */}
      {declines.map((d) => (
        <div
          className="game-invite-toast game-invite-toast--declined"
          key={`d-${d.gameId}-${d.by.username}`}
        >
          <div className="game-invite-text">
            <strong>{d.by.display}</strong> declined your {gameNames[d.gameType] ?? d.gameType}{" "}
            invite.
          </div>
          <div className="game-invite-actions">
            <button
              type="button"
              className="game-invite-decline"
              onClick={() => dismissDecline(d.gameId, d.by.username)}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
