import {
  type FriendshipInfo,
  withAuth,
  zFriendRequestPayload,
  zFriendshipUpdatePayload,
} from "@gamenite/shared";
import { type RestAPI } from "../types.ts";
import { checkAuth, getUserByUsername } from "../services/auth.service.ts";
import {
  getFriendships,
  removeFriendship,
  sendFriendRequest,
  updateFriendship,
} from "../services/friend.service.ts";
import { getSocketServer } from "./socket.controller.ts";

/**
 * POST /api/friend/request
 * Send a friend request to another user.
 * Body: WithAuth<{ toUsername: string }>
 */
export const postRequest: RestAPI<FriendshipInfo> = async (req, res) => {
  const body = withAuth(zFriendRequestPayload).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = (await checkAuth(body.data.auth)) ?? req.session;
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  const result = await sendFriendRequest(user, body.data.payload.toUsername);
  if ("error" in result) {
    res.status(400).send(result);
    return;
  }

  // Push a live notification so the recipient's home page updates immediately.
  // (Broadcast to everyone; the client only reacts if it's the recipient.)
  getSocketServer()?.emit("friendRequestReceived", result);

  res.send(result);
};

/**
 * POST /api/friend/:id
 * Accept, reject, or block a pending friend request.
 * Body: WithAuth<{ status: "accepted" | "rejected" | "blocked" }>
 */
export const postById: RestAPI<FriendshipInfo, { id: string }> = async (req, res) => {
  const body = withAuth(zFriendshipUpdatePayload).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = (await checkAuth(body.data.auth)) ?? req.session;
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  const result = await updateFriendship(req.params.id, user, body.data.payload.status);
  if ("error" in result) {
    res.status(400).send(result);
    return;
  }

  res.send(result);
};

/**
 * POST /api/friend/:id/remove
 * Un-friend: remove an existing friendship (either participant may do this).
 */
export const postRemove: RestAPI<FriendshipInfo, { id: string }> = async (req, res) => {
  const auth = (req.body as { auth?: { username: string; password: string } } | undefined)?.auth;
  const user = (auth ? await checkAuth(auth) : null) ?? req.session;
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  const result = await removeFriendship(req.params.id, user);
  if ("error" in result) {
    res.status(400).send(result);
    return;
  }
  res.send(result);
};

/**
 * GET /api/friend/list?username=:username
 * Return all friendships (pending and accepted) for a given user.
 */
export const getList: RestAPI<FriendshipInfo[]> = async (req, res) => {
  const username = typeof req.query["username"] === "string" ? req.query["username"] : null;
  if (!username) {
    res.status(400).send({ error: "username query param required" });
    return;
  }

  const found = await getUserByUsername(username);
  if (!found) {
    res.status(404).send({ error: "User not found" });
    return;
  }

  res.send(await getFriendships(found.userId));
};
