import { type ChatInfo } from "@gamenite/shared";
import { getMessagesById } from "./message.service.ts";
import { type UserWithId } from "../types.ts";
import type { ChatRecord, RecordId } from "../models.ts";
import { ChatRepo, MessageRepo } from "../repository.ts";
import { withKeyedLock } from "../lock.ts";

/**
 * Expand a stored chat
 *
 * @param chatId - Valid chat id
 * @returns the expanded chat info object
 */
async function populateChatInfo(chatId: RecordId): Promise<ChatInfo> {
  const chat = await ChatRepo.get(chatId);
  return {
    chatId,
    createdAt: new Date(chat.createdAt),
    messages: await getMessagesById(chat.messages),
  };
}

/**
 * Creates and store a new chat
 *
 * @param createdAt - Time of chat creation
 * @returns the chat's info object
 */
export async function createChat(createdAt: Date): Promise<ChatInfo> {
  const id = await ChatRepo.add({
    createdAt: createdAt.toISOString(),
    messages: [],
  });
  return await populateChatInfo(id);
}

/**
 * Produces the chat for a given id
 *
 * @param chatId - Ostensible chat id
 * @param user - Authenticated user
 * @returns the chat's info object
 * @throws if the chat id is not valid
 */
export async function forceChatById(chatId: string, user: UserWithId): Promise<ChatInfo> {
  const chat = await ChatRepo.find(chatId);
  if (!chat) throw new Error(`user ${user.username} accessed invalid chat id '${chatId}'`);

  return await populateChatInfo(chatId);
}

/**
 * Adds a message to a chat, updating the chat
 *
 * @param chatId - Ostensible chat id
 * @param user - Authenticated user
 * @param message - Valid message id
 * @returns the updated chat info object
 * @throws if the chat id is not valid
 */
export async function addMessageToChat(
  chatId: string,
  user: UserWithId,
  messageId: RecordId,
): Promise<ChatInfo> {
  // Serialize appends to this chat so concurrent messages don't clobber each other
  return withKeyedLock(`chat:${chatId}`, async () => {
    const chat = await ChatRepo.find(chatId);
    if (!chat) throw new Error(`user ${user.username} sent to invalid chat id`);
    const newChat: ChatRecord = {
      ...chat,
      messages: [...chat.messages, messageId],
    };
    await ChatRepo.set(chatId, newChat);
    return populateChatInfo(chatId);
  });
}

/**
 * Delete one of the caller's own messages from a chat (unlinks it). Throws if
 * the message isn't theirs.
 */
export async function deleteMessageFromChat(
  chatId: string,
  user: UserWithId,
  messageId: string,
): Promise<ChatInfo> {
  return withKeyedLock(`chat:${chatId}`, async () => {
    const chat = await ChatRepo.find(chatId);
    if (!chat) throw new Error(`user ${user.username} accessed invalid chat id`);
    const message = await MessageRepo.find(messageId);
    if (!message) throw new Error("Message not found");
    if (message.createdBy !== user.userId) {
      throw new Error(`user ${user.username} cannot delete another user's message`);
    }
    const newChat: ChatRecord = {
      ...chat,
      messages: chat.messages.filter((id) => id !== messageId),
    };
    await ChatRepo.set(chatId, newChat);
    return populateChatInfo(chatId);
  });
}
