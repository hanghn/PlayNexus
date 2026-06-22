import useThreadList from "../hooks/useThreadList.ts";
import { useNavigate } from "react-router-dom";
import useGameList from "../hooks/useGameList.ts";
import GameCard from "../components/GameCard.tsx";
import CreateGameMenu from "../components/CreateGameMenu.tsx";
import useTimeSince from "../hooks/useTimeSince.ts";
import "./Home.css";

export default function Home() {
  const threadList = useThreadList(6);
  const gameList = useGameList(10);
  const navigate = useNavigate();
  const timeSince = useTimeSince();

  return (
    <div className="lobby">
      <section className="lobby-section">
        <div className="lobby-head">
          <h2>Recent games</h2>
          <button className="link-arrow" onClick={() => navigate("/games")}>
            All games →
          </button>
        </div>
        {"message" in gameList ? (
          <div className="lobby-empty">{gameList.message}</div>
        ) : (
          <div className="game-grid" role="list" aria-label="Recent games">
            {gameList.map((game) => (
              <GameCard {...game} key={game.gameId.toString()} />
            ))}
          </div>
        )}
        <CreateGameMenu triggerClassName="lobby-cta" />
      </section>

      <section className="lobby-section">
        <div className="lobby-head">
          <h2>Recent forum posts</h2>
          <button className="link-arrow" onClick={() => navigate("/forum")}>
            All posts →
          </button>
        </div>
        {"message" in threadList ? (
          <div className="lobby-empty">{threadList.message}</div>
        ) : (
          <div className="post-list">
            {threadList.map((thread) => (
              <button
                className="post-card"
                key={thread.threadId.toString()}
                onClick={() => navigate(`/forum/post/${thread.threadId}`)}
              >
                <div className="post-title">{thread.title}</div>
                <div className="post-meta">
                  {thread.createdBy.display} · {thread.comments}{" "}
                  {thread.comments === 1 ? "reply" : "replies"} · {timeSince(thread.createdAt)}
                </div>
              </button>
            ))}
          </div>
        )}
        <button className="lobby-cta secondary-cta" onClick={() => navigate("/forum/post/new")}>
          + Create New Post
        </button>
      </section>
    </div>
  );
}
