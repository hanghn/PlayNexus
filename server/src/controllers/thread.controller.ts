import {
  addCommentToThread,
  createThread,
  deleteCommentFromThread,
  getThreadById,
  getThreadSummaries,
} from "../services/thread.service.ts";
import {
  type ThreadInfo,
  type ThreadSummary,
  withAuth,
  zCreateThreadMessage,
} from "@gamenite/shared";
import { type RestAPI } from "../types.ts";
import { z } from "zod";
import { checkAuth } from "../services/auth.service.ts";

/**
 * Handle GET requests to `/api/thread/list`. Returns all threads in reverse
 * chronological order by creation.
 */
export const getList: RestAPI<ThreadSummary[]> = async (req, res) => {
  res.send(await getThreadSummaries());
};

/**
 * Handle GET requests to `/api/thread/:id`. Returns either 404 or a thread
 * info object.
 */
export const getById: RestAPI<ThreadInfo, { id: string }> = async (req, res) => {
  const thread = await getThreadById(req.params.id);
  if (!thread) {
    res.status(404).send({ error: "Thread not found" });
    return;
  }

  res.send(thread);
};

/**
 * Handle POST requests to `/api/thread/create` that post a new thread.
 */
export const postCreate: RestAPI<ThreadInfo> = async (req, res) => {
  const body = withAuth(zCreateThreadMessage).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = (await checkAuth(body.data.auth)) ?? req.session;
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  res.send(await createThread(user, body.data.payload, new Date()));
};

/**
 * Handle POST requests to `/api/thread/:id/comment` that post a new
 * comment to a thread.
 */
export const postByIdComment: RestAPI<ThreadInfo, { id: string }> = async (req, res) => {
  const body = withAuth(z.string()).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = (await checkAuth(body.data.auth)) ?? req.session;
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  const thread = await addCommentToThread(req.params.id, user, body.data.payload, new Date());
  if (!thread) {
    res.status(404).send({ error: "Thread not found" });
    return;
  }

  res.send(thread);
};

/**
 * Handle POST `/api/thread/:id/comment/:commentId/delete`. Removes one of the
 * caller's own comments from the thread.
 */
export const postCommentDelete: RestAPI<ThreadInfo, { id: string; commentId: string }> = async (
  req,
  res,
) => {
  const auth = (req.body as { auth?: { username: string; password: string } } | undefined)?.auth;
  const user = (auth ? await checkAuth(auth) : null) ?? req.session;
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  const result = await deleteCommentFromThread(req.params.id, user, req.params.commentId);
  if (result === null) {
    res.status(404).send({ error: "Thread not found" });
    return;
  }
  if ("error" in result) {
    res.status(400).send(result);
    return;
  }
  res.send(result);
};
