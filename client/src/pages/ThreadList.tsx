import "./Forum.css";
import { useNavigate } from "react-router-dom";
import ThreadSummaryView from "../components/ThreadSummaryView.tsx";
import useThreadList from "../hooks/useThreadList.ts";

export default function ThreadList() {
  const threadList = useThreadList();
  const navigate = useNavigate();

  const count = "message" in threadList ? 0 : threadList.length;

  return (
    <div className="content forum-page">
      <div className="forum-hero">
        <div>
          <h2 className="forum-hero-title">Forum</h2>
          <p className="forum-hero-sub">
            {count} {count === 1 ? "thread" : "threads"}
          </p>
        </div>
        <button className="forum-cta" onClick={() => navigate("/forum/post/new")}>
          + New Post
        </button>
      </div>

      {"message" in threadList ? (
        <div className="forum-empty">{threadList.message}</div>
      ) : threadList.length === 0 ? (
        <div className="forum-empty">No posts yet — be the first to start a discussion!</div>
      ) : (
        <div className="forum-list" role="list">
          {threadList.map((thread) => (
            <ThreadSummaryView {...thread} key={thread.threadId.toString()} />
          ))}
        </div>
      )}
    </div>
  );
}
