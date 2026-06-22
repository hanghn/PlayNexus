import {
  type DMThreadInfo,
  type UserAuth,
  withAuth,
  zDMSendPayload,
  zDMThreadOpenPayload,
} from "@gamenite/shared";
import { z } from "zod";
import { type RestAPI, type SocketAPI, type UserWithId } from "../types.ts";
import { checkAuth, getUserByUsername } from "../services/auth.service.ts";
import {
  deleteDMMessage,
  getDMThread,
  getDMThreadsForUser,
  openDMThread,
  sendDMMessage,
} from "../services/dm.service.ts";
import { logSocketError } from "./socket.controller.ts";

/** Socket.io room name for a DM thread. */
const dmRoom = (threadId: string) => `dm:${threadId}`;

/**
 * Resolve the acting user, preferring the explicit login token over the socket
 * session cookie — so a stale cookie left over from a previous login can't be
 * recorded as the message sender (which made DMs show up under the wrong name).
 */
async function resolveActor(
  sessionUser: Promise<UserWithId | null> | UserWithId | null | undefined,
  auth: UserAuth,
): Promise<UserWithId> {
  const user = (await checkAuth(auth)) ?? (await sessionUser);
  if (!user) throw new Error("Invalid auth");
  return user;
}

/**
 * POST /api/dm/open
 * Open (or retrieve) a DM thread with another user.
 * Body: WithAuth<{ withUsername: string }>
 */
export const postOpen: RestAPI<DMThreadInfo> = async (req, res) => {
  const body = withAuth(zDMThreadOpenPayload).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = (await checkAuth(body.data.auth)) ?? req.session;
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  const result = await openDMThread(user, body.data.payload.withUsername);
  if ("error" in result) {
    res.status(400).send(result);
    return;
  }

  res.send(result);
};

/**
 * POST /api/dm/:id/message
 * Send a message to a DM thread.
 * Body: WithAuth<{ threadId: string; text: string }>
 */
export const postMessage: RestAPI<DMThreadInfo, { id: string }> = async (req, res) => {
  const body = withAuth(zDMSendPayload).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = (await checkAuth(body.data.auth)) ?? req.session;
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  const result = await sendDMMessage(req.params.id, user, body.data.payload.text);
  if ("error" in result) {
    res.status(400).send(result);
    return;
  }

  res.send(result);
};

/**
 * GET /api/dm/:id
 * Retrieve a single DM thread (must be a participant).
 * Query param: username + password for auth.
 */
export const getById: RestAPI<DMThreadInfo, { id: string }> = async (req, res) => {
  const username = typeof req.query["username"] === "string" ? req.query["username"] : null;
  const password = typeof req.query["password"] === "string" ? req.query["password"] : null;

  // Prefer an explicit token (username + password) when present, but fall back
  // to the session cookie — most of the app authenticates by cookie/token where
  // `password` is undefined, so requiring it outright wrongly rejected them.
  const user =
    (username && password ? await checkAuth({ username, password }) : null) ?? req.session;
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  const thread = await getDMThread(req.params.id, user);
  if (!thread) {
    res.status(404).send({ error: "Thread not found" });
    return;
  }

  res.send(thread);
};

/**
 * GET /api/dm/list?username=
 * List all DM threads for a user (public read — returns participant info only).
 */
export const getList: RestAPI<DMThreadInfo[]> = async (req, res) => {
  const username = typeof req.query["username"] === "string" ? req.query["username"] : null;
  if (!username) {
    res.status(400).send({ error: "username query param required" });
    return;
  }

  const user = await getUserByUsername(username);
  if (!user) {
    res.status(404).send({ error: "User not found" });
    return;
  }

  res.send(await getDMThreadsForUser(user.userId));
};

/*** Scoket handlers ***/

/**
 * Socket "dmJoin": subscribe this connection to a DM thread's room so it
 * receives future messages. Only participants may join.
 */
export const socketJoin: SocketAPI = (socket) => async (body) => {
  try {
    const { auth, payload: threadId } = withAuth(z.string()).parse(body);
    const user = await resolveActor(socket.data?.sessionUser, auth);
    // getDMThread enforces that the user is a participant (returns null otherwise)
    const thread = await getDMThread(threadId, user);
    if (!thread) {
      throw new Error(`user ${user.username} cannot join DM thread ${threadId}`);
    }
    await socket.join(dmRoom(threadId));
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Socket "dmLeave": stop receiving messages for a DM thread.
 */
export const socketLeave: SocketAPI = (socket) => async (body) => {
  try {
    const { auth, payload: threadId } = withAuth(z.string()).parse(body);
    await resolveActor(socket.data?.sessionUser, auth); // validate the caller
    await socket.leave(dmRoom(threadId));
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Socket "dmSendMessage": persist a message and broadcast it to everyone in
 * the thread's room (including the sender, so their UI updates the same way).
 */
export const socketSendMessage: SocketAPI = (socket, io) => async (body) => {
  try {
    const {
      auth,
      payload: { threadId, text },
    } = withAuth(zDMSendPayload).parse(body);
    const user = await resolveActor(socket.data?.sessionUser, auth);

    const result = await sendDMMessage(threadId, user, text);
    if ("error" in result) {
      throw new Error(result.error);
    }

    // sendDMMessage appends the new message last in the populated thread
    const message = result.messages[result.messages.length - 1];
    io.to(dmRoom(threadId)).emit("dmNewMessage", { threadId, message });

    // Also notify the recipient on their personal room, so they get an unread
    // badge / toast even when they aren't currently viewing this thread.
    const recipient = result.participants.find((p) => p.username !== message.createdBy.username);
    if (recipient) {
      io.to(`user:${recipient.username}`).emit("dmNotification", {
        threadId,
        from: { username: message.createdBy.username, display: message.createdBy.display },
      });
    }
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Socket "dmDeleteMessage": delete one of your own messages and tell everyone
 * in the thread's room to drop it.
 */
export const socketDeleteMessage: SocketAPI = (socket, io) => async (body) => {
  try {
    const {
      auth,
      payload: { threadId, messageId },
    } = withAuth(z.object({ threadId: z.string(), messageId: z.string() })).parse(body);
    const user = await resolveActor(socket.data?.sessionUser, auth);

    const result = await deleteDMMessage(threadId, user, messageId);
    if ("error" in result) throw new Error(result.error);

    io.to(dmRoom(threadId)).emit("dmMessageDeleted", { threadId, messageId });
  } catch (err) {
    logSocketError(socket, err);
  }
};
