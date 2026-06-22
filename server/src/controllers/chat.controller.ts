import { withAuth, zNewMessageRequest, type UserAuth } from "@gamenite/shared";
import { type SocketAPI, type UserWithId } from "../types.ts";
import { z } from "zod";
import {
  addMessageToChat,
  deleteMessageFromChat,
  forceChatById,
} from "../services/chat.service.ts";
import { populateSafeUserInfo } from "../services/user.service.ts";
import { createMessage } from "../services/message.service.ts";
import { logSocketError } from "./socket.controller.ts";
import { checkAuth } from "../services/auth.service.ts";

/**
 * Resolve the acting user, preferring the explicit login token over the socket
 * session cookie — so a stale cookie left over from a previous login (or a
 * cookie shared across browser tabs) can't be recorded as the message sender,
 * which made every chat message show up under the same user.
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
 * Handle a socket request to join a chat: send the connection the chat's
 * current contents and  signal to everyone in the chat that the user has
 * joined
 */
export const socketJoin: SocketAPI = (socket) => async (body) => {
  try {
    const { auth, payload: chatId } = withAuth(z.string()).parse(body);
    const user = await resolveActor(socket.data?.sessionUser, auth);
    const chat = await forceChatById(chatId, user);
    await socket.join(chatId);

    // Send a "successfully joined" message to the person who just joined
    socket.emit("chatJoined", chat);

    // Send a "user successfully joined" message to everyone else (does not go
    // to newly-joined user)
    socket
      .to(chatId)
      .emit("chatUserJoined", { chatId, user: await populateSafeUserInfo(user.userId) });
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Handle a socket request to leave a chat: stop sending that socket messages
 * about the chat and send everyone else a message that they left.
 */
export const socketLeave: SocketAPI = (socket) => async (body) => {
  try {
    const { auth, payload: chatId } = withAuth(z.string()).parse(body);
    const user = await resolveActor(socket.data?.sessionUser, auth);
    if (!socket.rooms.has(chatId)) {
      throw new Error(`user ${user.username} left chat they weren't in`);
    }
    await socket.leave(chatId);
    socket
      .to(chatId)
      .emit("chatUserLeft", { chatId, user: await populateSafeUserInfo(user.userId) });
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Handle a socket request to send a message to the chat: store the chat and
 * let everyone know about the new message.
 */
export const socketSendMessage: SocketAPI = (socket, io) => async (body) => {
  try {
    const {
      auth,
      payload: { chatId, text },
    } = withAuth(zNewMessageRequest).parse(body);
    const user = await resolveActor(socket.data?.sessionUser, auth);
    const now = new Date();
    const message = await createMessage(user, text, now);
    await addMessageToChat(chatId, user, message.messageId);

    // Send the message to everyone, including the sender
    io.to(chatId).emit("chatNewMessage", { chatId, message });
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Handle a socket request to delete one of the caller's own chat messages, then
 * tell everyone in the chat to remove it.
 */
export const socketDeleteMessage: SocketAPI = (socket, io) => async (body) => {
  try {
    const {
      auth,
      payload: { chatId, messageId },
    } = withAuth(z.object({ chatId: z.string(), messageId: z.string() })).parse(body);
    const user = await resolveActor(socket.data?.sessionUser, auth);
    await deleteMessageFromChat(chatId, user, messageId);
    io.to(chatId).emit("chatMessageDeleted", { chatId, messageId });
  } catch (err) {
    logSocketError(socket, err);
  }
};
