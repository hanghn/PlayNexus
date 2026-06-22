import { useEffect, useState } from "react";
import { setAnnouncer } from "../lib/liveAnnounce.ts";

/**
 * Renders the app's two visually-hidden ARIA live regions (polite + assertive)
 * and wires them to the `announce()` helper. Mounted once, globally, so any
 * event can give screen-reader users a spoken cue.
 */
export default function LiveAnnouncer() {
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");

  useEffect(() => {
    setAnnouncer((message, isAssertive) => {
      // Clear first so an identical consecutive message is still re-announced.
      if (isAssertive) {
        setAssertive("");
        requestAnimationFrame(() => setAssertive(message));
      } else {
        setPolite("");
        requestAnimationFrame(() => setPolite(message));
      }
    });
    return () => setAnnouncer(null);
  }, []);

  // Plain aria-live (no role="status"/"alert") so these regions don't collide
  // with the in-game result alert that tests/screen readers look for; the
  // aria-live attribute alone makes them proper live regions.
  return (
    <>
      <div className="visuallyHidden" aria-live="polite" aria-atomic="true">
        {polite}
      </div>
      <div className="visuallyHidden" aria-live="assertive" aria-atomic="true">
        {assertive}
      </div>
    </>
  );
}
