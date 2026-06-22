import "./GameList.css";
import type { GameInfo } from "@gamenite/shared";
import { useState } from "react";
import GameRow from "../components/GameRow.tsx";
import CreateGameMenu from "../components/CreateGameMenu.tsx";
import useGameList from "../hooks/useGameList.ts";

type Filter = "all" | GameInfo["status"];

/** Filter tabs shown above the list. */
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Live" },
  { key: "waiting", label: "Waiting" },
  { key: "done", label: "Finished" },
];

const PAGE_SIZE = 20;

export default function GameList() {
  const gameList = useGameList();
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const isEmpty = "message" in gameList;
  const games = isEmpty ? [] : gameList;

  const counts: Record<Filter, number> = {
    all: games.length,
    active: games.filter((g) => g.status === "active").length,
    waiting: games.filter((g) => g.status === "waiting").length,
    done: games.filter((g) => g.status === "done").length,
  };

  const filtered = filter === "all" ? games : games.filter((g) => g.status === filter);
  const visible = filtered.slice(0, limit);
  const hasMore = filtered.length > limit;

  const pick = (key: Filter) => {
    setFilter(key);
    setLimit(PAGE_SIZE); // restart paging when the filter changes
  };

  return (
    <div className="content games-page">
      <header className="games-hero">
        <div>
          <h2 className="games-hero-title">All games</h2>
          <p className="games-hero-sub">
            {isEmpty
              ? "No games yet — be the first to start one."
              : `${games.length} game${games.length === 1 ? "" : "s"} to watch or join`}
          </p>
        </div>
        <CreateGameMenu triggerClassName="games-cta" />
      </header>

      {isEmpty ? (
        <div className="games-empty">{gameList.message}</div>
      ) : (
        <>
          <div className="games-filters" role="tablist" aria-label="Filter games by status">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                role="tab"
                aria-selected={filter === key}
                className={`games-filter${filter === key ? " is-active" : ""}`}
                onClick={() => pick(key)}
              >
                {label}
                <span className="games-filter-count">{counts[key]}</span>
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="games-empty">No {filter === "all" ? "" : filter} games right now.</div>
          ) : (
            <div className="games-list" role="list">
              {visible.map((game) => (
                <GameRow {...game} key={game.gameId.toString()} />
              ))}
            </div>
          )}

          {hasMore && (
            <button className="games-more" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
              View more games ({filtered.length - limit} more)
            </button>
          )}
        </>
      )}
    </div>
  );
}
