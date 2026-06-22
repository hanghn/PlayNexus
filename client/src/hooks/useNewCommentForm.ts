import { type ChangeEvent, type SubmitEvent, useState } from "react";
import useAuth from "./useAuth.ts";
import { addCommentToThread } from "../services/threadService.ts";
import type { ThreadInfo } from "@gamenite/shared";
import { encodeReply } from "../util/replyQuote.ts";

/** A comment/post being replied to. */
export interface CommentReplyTarget {
  sender: string;
  text: string;
}

/**
 * Custom hook to manage comment creation form logic
 * @param threadId - id of the thread to add a comment to
 * @param firstPost - are there other known posts? (used for validation)
 * @param setThread - callback to update the parent page if thread is updated
 * @returns an object containing
 *  - Form value `comment`
 *  - Possibly-null error message `err`
 *  - Form handlers `handleInputChange` and `handleSubmit`
 */
export default function useNewCommentForm(
  threadId: string,
  firstPost: boolean,
  setThread: (thread: ThreadInfo) => void,
) {
  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState<CommentReplyTarget | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const auth = useAuth();

  function handleInputChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setComment(e.target.value);
  }

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (comment.trim() === "") {
      setErr("Please put some text in the comment");
      return;
    }

    if (
      firstPost &&
      comment.trim().toLocaleLowerCase().startsWith("first") &&
      comment.length < 15
    ) {
      setErr("Please put some effort into the comment");
      return;
    }

    // Carry the quoted comment inline so the reply shows what it responds to.
    const body = replyTo ? encodeReply(replyTo.sender, replyTo.text, comment) : comment;

    try {
      const newThread = await addCommentToThread(auth, threadId, body);
      setErr(null);
      setThread(newThread);
      setComment("");
      setReplyTo(null);
    } catch (err) {
      setErr(`${err}`);
    }
  }

  return { comment, setComment, replyTo, setReplyTo, err, handleInputChange, handleSubmit };
}
