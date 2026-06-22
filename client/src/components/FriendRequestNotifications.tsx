import "./FriendRequestNotifications.css";
import useFriendRequests from "../hooks/useFriendRequests.ts";

/**
 * Displays friend request notifications with accept/reject options
 */
export default function FriendRequestNotifications() {
  const { incomingRequests, acceptFriendRequest, rejectFriendRequest, loading } =
    useFriendRequests();

  if (loading) {
    return <div className="friend-request-container">Loading friend requests...</div>;
  }

  return (
    <div className="friend-request-container">
      <h3>Friend Requests ({incomingRequests.length})</h3>
      {incomingRequests.length === 0 ? (
        <p className="friend-request-empty">No pending friend requests.</p>
      ) : (
        <ul className="friend-request-list">
          {incomingRequests.map((request) => (
            <li key={request.friendshipId} className="friend-request-item">
              <div className="friend-request-info">
                <span className="friend-request-sender">
                  <strong>{request.from.display}</strong> (@{request.from.username})
                </span>
                <span className="friend-request-time">
                  {new Date(request.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="friend-request-actions">
                <button
                  className="primary narrow"
                  onClick={() => acceptFriendRequest(request.friendshipId)}
                >
                  Accept
                </button>
                <button
                  className="secondary narrow"
                  onClick={() => rejectFriendRequest(request.friendshipId)}
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
