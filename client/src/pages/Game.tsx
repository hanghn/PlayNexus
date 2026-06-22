import "./Game.css";
import { useParams } from "react-router-dom";
import { getGameById } from "../services/gameService.ts";
import { useEffect, useState } from "react";
import type { GameInfo } from "@gamenite/shared";
import ChatPanel from "../components/ChatPanel.tsx";
import GamePanel from "../components/GamePanel.tsx";

export default function Game() {
  const { gameId } = useParams();
  const [game, setGame] = useState<GameInfo | null>(null);

  useEffect(() => {
    let ignore = false;
    // non-nullish assertion is ok here given that Game is only called in a
    // route with `:gameId`
    getGameById(gameId!)
      .then((game) => {
        if (ignore) return;
        setGame(game);
      })
      .catch(() => {
        // ignore
      });

    return () => {
      ignore = true;
    };
  }, [gameId]);

  // Chat starts collapsed so the game has the full width on open; players can
  // show it with the "Chat" toggle.
  const [chatOpen, setChatOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const chatVisible = chatOpen && !expanded;

  return (
    game && (
      <>
        <div
          className={`gameContainer${chatVisible ? "" : " chatHidden"}${expanded ? " gameMaximized" : ""}`}
        >
          <GamePanel {...game} />
          <ChatPanel chatId={game.chat} />
          <div className="gameTools">
            <button
              type="button"
              className="narrowcenter gameToolBtn"
              onClick={() => setExpanded((v) => !v)}
              aria-pressed={expanded}
              aria-label={expanded ? "Exit full screen" : "Play full screen"}
              title={expanded ? "Exit full screen" : "Full screen"}
            >
              <span aria-hidden="true">{expanded ? "🗗 Exit full screen" : "⤢ Full screen"}</span>
            </button>
            {!expanded && (
              <button
                type="button"
                className="narrowcenter gameToolBtn"
                onClick={() => setChatOpen((open) => !open)}
                aria-expanded={chatOpen}
                aria-controls="game-chat-panel"
                aria-label={chatOpen ? "Hide chat panel" : "Show chat panel"}
                title={chatOpen ? "Hide chat" : "Show chat"}
              >
                <span aria-hidden="true">💬 {chatOpen ? "Hide chat" : "Chat"}</span>
              </button>
            )}
          </div>
        </div>
      </>
    )
  );
}
