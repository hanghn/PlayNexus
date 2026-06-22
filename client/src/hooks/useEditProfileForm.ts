import { useState, type SubmitEvent } from "react";
import useLoginContext from "./useLoginContext.ts";
import useAuth from "./useAuth.ts";
import { updateUser } from "../services/userService.ts";
import { fileToAvatarDataUrl } from "../lib/image.ts";
import type { UserUpdateRequest } from "@gamenite/shared";

/**
 * Custom hook to manage profile form logic
 * @returns an object containing
 *  - Form values `display`, `password`, and `confirm`
 *  - Form setters `setDisplay`, `setPassword`, and `setConfirm`
 *  - Possibly-null error message `err`
 *  - Submission handler `handleSubmit`
 */
export default function useEditProfileForm() {
  const { user, reset, patchUser } = useLoginContext();
  const [display, setDisplay] = useState(user.display);
  const [bio, setBio] = useState(user.bio ?? "");
  const [bioStatus, setBioStatus] = useState<null | string>(null);
  // `accent` is the color currently applied to the profile; `accentChoice` is
  // the swatch the user has picked but not yet saved.
  const [accent, setAccent] = useState(user.accentColor ?? "");
  const [accentChoice, setAccentChoice] = useState(user.accentColor ?? "");
  const [accentStatus, setAccentStatus] = useState<null | string>(null);
  // Avatar image, stored inline on the user record as a data URL.
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [avatarStatus, setAvatarStatus] = useState<null | string>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<null | string>(null);
  const auth = useAuth();

  /**
   * Saves just the bio to the profile, without affecting the rest of the form.
   */
  const handleSaveBio = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setBioStatus(null);
    // Strip leading/trailing whitespace so the bio starts and ends with real text.
    const trimmed = bio.trim();
    setBio(trimmed);
    try {
      await updateUser(auth, { bio: trimmed });
      patchUser?.({ bio: trimmed });
      setBioStatus("Bio saved");
    } catch (err) {
      setBioStatus(`${err}`);
    }
  };

  /**
   * Saves the picked accent color to the profile and applies it.
   */
  const handleSaveAccent = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setAccentStatus(null);
    try {
      await updateUser(auth, { accentColor: accentChoice });
      setAccent(accentChoice);
      patchUser?.({ accentColor: accentChoice });
      setAccentStatus("Color saved");
    } catch (err) {
      setAccentStatus(`${err}`);
    }
  };

  /**
   * Resizes the chosen image file and saves it as the profile avatar, applying
   * it everywhere immediately (no re-login needed).
   */
  const handleSaveAvatar = async (file: File) => {
    setAvatarStatus(null);
    setSavingAvatar(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      await updateUser(auth, { avatarUrl: dataUrl });
      setAvatarUrl(dataUrl);
      patchUser?.({ avatarUrl: dataUrl });
      setAvatarStatus("Avatar updated");
    } catch (err) {
      setAvatarStatus(err instanceof Error ? err.message : `${err}`);
    } finally {
      setSavingAvatar(false);
    }
  };

  /** Removes the avatar, falling back to the initials placeholder. */
  const handleClearAvatar = async () => {
    setAvatarStatus(null);
    setSavingAvatar(true);
    try {
      await updateUser(auth, { avatarUrl: "" });
      setAvatarUrl("");
      patchUser?.({ avatarUrl: "" });
      setAvatarStatus("Avatar removed");
    } catch (err) {
      setAvatarStatus(err instanceof Error ? err.message : `${err}`);
    } finally {
      setSavingAvatar(false);
    }
  };

  /**
   * Handles submission of the form
   */
  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (user.display === display && password === confirm && password === "") {
      setErr("No changes to submit");
      return;
    }

    if (display.trim() !== display) {
      setErr("Display names can't begin or end with whitespace");
      return;
    }

    if (display.trim() === "") {
      setErr("Please enter a display name");
      return;
    }

    if (password.trim() !== password) {
      setErr("Passwords can't begin or end with whitespace");
      return;
    }

    if (password !== confirm) {
      setErr("Passwords don't match");
      return;
    }

    const updates: UserUpdateRequest = {};
    if (display !== user.display) updates.display = display;
    if (password !== "") updates.password = password;
    try {
      await updateUser(auth, updates);
    } catch (err) {
      setErr(`${err}`);
      return;
    }

    // We need to do this — or do something else that resets the login context
    reset();
  };

  return {
    display,
    setDisplay,
    bio,
    setBio,
    bioStatus,
    handleSaveBio,
    accent,
    accentChoice,
    setAccentChoice,
    accentStatus,
    handleSaveAccent,
    avatarUrl,
    avatarStatus,
    savingAvatar,
    handleSaveAvatar,
    handleClearAvatar,
    password,
    setPassword,
    confirm,
    setConfirm,
    err,
    handleSubmit,
  };
}
