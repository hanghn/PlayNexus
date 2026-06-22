import { useCallback, useEffect, useState } from "react";
import type { SecurityStatus } from "@gamenite/shared";
import {
  disableMfa,
  getSecurity,
  revokeAllSessions,
  setRemember,
  startMfaEnroll,
  verifyMfaEnroll,
} from "../services/userService.ts";
import { apiErrorMessage } from "../services/api.ts";
import useLoginContext from "./useLoginContext.ts";

/** Stage of the 2FA enrollment flow shown in the UI. */
export type EnrollStage = "idle" | "codeSent";

/**
 * Drives the profile security settings: loads the current 2FA / remember-me
 * status and exposes actions to enroll/disable 2FA, toggle persistent sessions,
 * and sign out everywhere. Keeps all wire-up out of the component.
 */
export default function useSecuritySettings() {
  const { reset } = useLoginContext();
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 2FA enrollment local state.
  const [stage, setStage] = useState<EnrollStage>("idle");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getSecurity()
      .then(setStatus)
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Run an async action with shared busy/error handling. */
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  /** Send a confirmation code to the entered email to begin enrollment. */
  const sendEnrollCode = () =>
    run(async () => {
      const { challengeId: id } = await startMfaEnroll(email.trim());
      setChallengeId(id);
      setStage("codeSent");
    });

  /** Verify the enrollment code; on success 2FA turns on. */
  const confirmEnroll = () =>
    run(async () => {
      if (!challengeId) return;
      await verifyMfaEnroll(challengeId, code.trim());
      setStatus(await getSecurity());
      setStage("idle");
      setEmail("");
      setCode("");
      setChallengeId(null);
    });

  /** Cancel an in-progress enrollment. */
  const cancelEnroll = () => {
    setStage("idle");
    setCode("");
    setChallengeId(null);
    setError(null);
  };

  /** Turn off 2FA and unlink the email. */
  const disable2FA = () =>
    run(async () => {
      await disableMfa();
      setStatus(await getSecurity());
    });

  /** Toggle whether sessions persist across browser restarts. */
  const toggleRemember = (remember: boolean) =>
    run(async () => setStatus(await setRemember(remember)));

  /** Sign out of every device, then drop the local session. */
  const signOutEverywhere = () =>
    run(async () => {
      await revokeAllSessions();
      reset();
    });

  return {
    status,
    error,
    busy,
    stage,
    email,
    setEmail,
    code,
    setCode,
    sendEnrollCode,
    confirmEnroll,
    cancelEnroll,
    disable2FA,
    toggleRemember,
    signOutEverywhere,
  };
}
