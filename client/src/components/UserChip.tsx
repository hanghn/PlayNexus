import { Link } from "react-router-dom";
import "./UserChip.css";

/* Deterministic accent (green / blue / red) per user, matching the rest of the app. */
const ACCENTS = ["var(--teal)", "var(--blue)", "var(--coral)"];
function accentFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) % 997;
  return ACCENTS[h % ACCENTS.length];
}

interface ChipUser {
  username: string;
  display: string;
  avatarUrl?: string;
  accentColor?: string;
}

/**
 * A small avatar + name that links to a user's (read-only) profile. Used
 * wherever a user appears across the app so profile pictures and profile
 * navigation are consistent everywhere.
 */
export default function UserChip({
  user,
  size = 1.5,
  link = true,
  showName = true,
}: {
  user: ChipUser;
  /** Avatar diameter in rem. */
  size?: number;
  /** Whether to link to the user's profile. */
  link?: boolean;
  /** Whether to show the display name next to the avatar. */
  showName?: boolean;
}) {
  const initial = (user.display || user.username || "?").charAt(0).toUpperCase();
  // The user's chosen accent color shows as a ring around their avatar.
  const ring = user.accentColor ? { boxShadow: `0 0 0 2px ${user.accentColor}` } : null;
  const dim = { width: `${size}rem`, height: `${size}rem`, ...ring };

  const avatar = user.avatarUrl ? (
    <img className="userChip-avatar userChip-avatar--img" style={dim} src={user.avatarUrl} alt="" />
  ) : (
    <span
      className="userChip-avatar"
      style={{ ...dim, background: accentFor(user.username), fontSize: `${size * 0.45}rem` }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );

  const body = (
    <span className="userChip">
      {avatar}
      {showName && <span className="userChip-name">{user.display}</span>}
    </span>
  );

  if (!link) return body;
  return (
    <Link
      to={`/profile/${user.username}`}
      className="userChip-link"
      onClick={(e) => e.stopPropagation()}
    >
      {body}
    </Link>
  );
}
