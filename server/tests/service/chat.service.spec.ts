import { describe, it, expect } from "vitest";
import { getUserByUsername } from "../../src/services/auth.service.ts";
import {
  createChat,
  forceChatById,
  addMessageToChat,
  deleteMessageFromChat,
} from "../../src/services/chat.service.ts";
import { createMessage } from "../../src/services/message.service.ts";
import type { UserWithId } from "../../src/types.ts";

async function getUser(name: string): Promise<UserWithId> {
  const u = await getUserByUsername(name);
  if (!u) throw new Error(`seed user ${name} missing`);
  return u;
}

describe("chat.service", () => {
  it("creates an empty chat", async () => {
    expect((await createChat(new Date())).messages).toHaveLength(0);
  });

  it("forceChatById returns the chat", async () => {
    const u0 = await getUser("user0");
    const chat = await createChat(new Date());
    expect((await forceChatById(chat.chatId, u0)).chatId).toBe(chat.chatId);
  });

  it("forceChatById throws on an invalid id", async () => {
    const u0 = await getUser("user0");
    await expect(forceChatById("nope", u0)).rejects.toThrow();
  });

  it("addMessageToChat appends a message", async () => {
    const u0 = await getUser("user0");
    const chat = await createChat(new Date());
    const msg = await createMessage(u0, "hi", new Date());
    expect((await addMessageToChat(chat.chatId, u0, msg.messageId)).messages).toHaveLength(1);
  });

  it("addMessageToChat throws on an invalid chat", async () => {
    const u0 = await getUser("user0");
    const msg = await createMessage(u0, "hi", new Date());
    await expect(addMessageToChat("nope", u0, msg.messageId)).rejects.toThrow();
  });

  describe("deleteMessageFromChat", () => {
    it("throws on an invalid chat", async () => {
      const u0 = await getUser("user0");
      await expect(deleteMessageFromChat("nope", u0, "m")).rejects.toThrow();
    });

    it("throws when the message doesn't exist", async () => {
      const u0 = await getUser("user0");
      const chat = await createChat(new Date());
      await expect(deleteMessageFromChat(chat.chatId, u0, "no-such")).rejects.toThrow();
    });

    it("throws when deleting another user's message", async () => {
      const u0 = await getUser("user0");
      const u1 = await getUser("user1");
      const chat = await createChat(new Date());
      const msg = await createMessage(u1, "u1 msg", new Date());
      await addMessageToChat(chat.chatId, u1, msg.messageId);
      await expect(deleteMessageFromChat(chat.chatId, u0, msg.messageId)).rejects.toThrow();
    });

    it("deletes the caller's own message", async () => {
      const u0 = await getUser("user0");
      const chat = await createChat(new Date());
      const msg = await createMessage(u0, "mine", new Date());
      await addMessageToChat(chat.chatId, u0, msg.messageId);
      expect((await deleteMessageFromChat(chat.chatId, u0, msg.messageId)).messages).toHaveLength(
        0,
      );
    });
  });
});
