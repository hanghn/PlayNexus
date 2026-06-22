import { useNavigate } from "react-router-dom";
import useSocialToasts from "../hooks/useSocialToasts.ts";
import "./SocialToasts.css";

/**
 * Floating toasts for incoming DMs and friend requests. Mounted globally so
 * they appear on any page; clicking one jumps to the relevant page.
 */
export default function SocialToasts() {
  const { toasts, dismiss, pause, resume } = useSocialToasts();
  const navigate = useNavigate();

  if (toasts.length === 0) return null;

  return (
    // Pause the auto-dismiss timer while the stack is hovered or keyboard-focused
    // so a keyboard user has time to Tab in and act before a toast disappears.
    <div
      className="social-toast-stack"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      {toasts.map((t) => (
        <div className="social-toast" key={t.id}>
          <button
            type="button"
            className="social-toast-main"
            onClick={() => {
              dismiss(t.id);
              void navigate(t.to);
            }}
          >
            <span className="social-toast-icon" aria-hidden="true">
              {t.kind === "friend" ? "👥" : "💬"}
            </span>
            <span className="social-toast-text">{t.text}</span>
          </button>
          <button
            type="button"
            className="social-toast-x"
            aria-label="Dismiss notification"
            onClick={() => dismiss(t.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
