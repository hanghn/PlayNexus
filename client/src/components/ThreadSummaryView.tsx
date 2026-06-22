import "./ThreadSummaryView.css";
import { useNavigate } from "react-router-dom";
import type { ThreadSummary } from "@gamenite/shared";
import useTimeSince from "../hooks/useTimeSince.ts";
import UserChip from "./UserChip.tsx";

export default function ThreadSummaryView({
  threadId,
  createdBy,
  createdAt,
  title,
  comments,
}: ThreadSummary) {
  const navigate = useNavigate();
  const timeSince = useTimeSince();

  return (
    <div
      className="thread-row"
      role="listitem"
      tabIndex={0}
      onClick={() => navigate(`/forum/post/${threadId}`)}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/forum/post/${threadId}`)}
    >
      <div className="thread-row-replies">
        <span className="thread-row-replies-count">{comments}</span>
        {comments === 1 ? "reply" : "replies"}
      </div>

      <div className="thread-row-main">
        <div className="thread-row-title">{title}</div>
        <div className="thread-row-meta">
          by <UserChip user={createdBy} size={1.3} />
        </div>
      </div>

      <div className="thread-row-activity">{timeSince(createdAt)}</div>
    </div>
  );
}
