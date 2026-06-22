import { describe, it, expect } from "vitest";
import { getUserByUsername } from "../../src/services/auth.service.ts";
import {
  openDMThread,
  sendDMMessage,
  deleteDMMessage,
  getDMThread,
  getDMThreadsForUser,
} from "../../src/services/dm.service.ts";
import {
  sendFriendRequest,
  updateFriendship,
  removeFriendship,
  getFriendships,
} from "../../src/services/friend.service.ts";
import type { UserWithId } from "../../src/types.ts";

// setup.ts re-seeds before each test: Bob and Doris are accepted friends with a
// sample DM thread; user0..user3 are unconnected strangers.
async function getUser(name: string): Promise<UserWithId> {
  const u = await getUserByUsername(name);
  if (!u) throw new Error(`seed user ${name} missing`);
  return u;
}

/** The seeded Bob↔Doris thread id. */
async function bobDorisThreadId(): Promise<string> {
  const bob = await getUser("bob");
  const t = await openDMThread(bob, "doris");
  if ("error" in t) throw new Error(t.error);
  return t.threadId;
}

describe("dm.service", () => {
  describe("openDMThread", () => {
    it("rejects messaging yourself", async () => {
      const bob = await getUser("bob");
      expect(await openDMThread(bob, "bob")).toEqual({ error: expect.any(String) });
    });

    it("rejects an unknown recipient", async () => {
      const bob = await getUser("bob");
      expect(await openDMThread(bob, "ghost")).toEqual({ error: "User not found" });
    });

    it("rejects messaging a non-friend", async () => {
      const u0 = await getUser("user0");
      expect(await openDMThread(u0, "user1")).toEqual({ error: "You can only message friends" });
    });

    it("returns the existing thread between friends", async () => {
      const bob = await getUser("bob");
      const t = await openDMThread(bob, "doris");
      expect("error" in t).toBe(false);
      if (!("error" in t)) expect(t.participants).toHaveLength(2);
    });

    it("creates a new thread for newly accepted friends", async () => {
      const u0 = await getUser("user0");
      const u1 = await getUser("user1");
      const req = await sendFriendRequest(u0, "user1");
      if ("error" in req) throw new Error(req.error);
      await updateFriendship(req.friendshipId, u1, "accepted");

      const t = await openDMThread(u0, "user1");
      expect("error" in t).toBe(false);
      if (!("error" in t)) expect(t.messages).toHaveLength(0);
    });
  });

  describe("sendDMMessage", () => {
    it("errors on a missing thread", async () => {
      const bob = await getUser("bob");
      expect(await sendDMMessage("missing", bob, "hi")).toEqual({ error: "Thread not found" });
    });

    it("rejects a non-participant", async () => {
      const u2 = await getUser("user2");
      expect(await sendDMMessage(await bobDorisThreadId(), u2, "hi")).toEqual({
        error: "Not a participant",
      });
    });

    it("rejects messaging after the two un-friend", async () => {
      const bob = await getUser("bob");
      const threadId = await bobDorisThreadId();
      const friendship = (await getFriendships(bob.userId))[0];
      await removeFriendship(friendship.friendshipId, bob);
      expect(await sendDMMessage(threadId, bob, "hi")).toEqual({
        error: "You can only message friends",
      });
    });

    it("appends a message for a participant", async () => {
      const bob = await getUser("bob");
      const threadId = await bobDorisThreadId();
      const before = (await getDMThread(threadId, bob))!.messages.length;
      const res = await sendDMMessage(threadId, bob, "fresh message");
      expect("error" in res).toBe(false);
      if (!("error" in res)) {
        expect(res.messages).toHaveLength(before + 1);
        expect(res.messages.at(-1)?.text).toBe("fresh message");
      }
    });
  });

  describe("deleteDMMessage", () => {
    it("errors on a missing thread", async () => {
      const bob = await getUser("bob");
      expect(await deleteDMMessage("missing", bob, "m")).toEqual({ error: "Thread not found" });
    });

    it("rejects a non-participant", async () => {
      const u2 = await getUser("user2");
      expect(await deleteDMMessage(await bobDorisThreadId(), u2, "m")).toEqual({
        error: "Not a participant",
      });
    });

    it("errors on a missing message", async () => {
      const bob = await getUser("bob");
      expect(await deleteDMMessage(await bobDorisThreadId(), bob, "no-such")).toEqual({
        error: "Message not found",
      });
    });

    it("won't delete someone else's message", async () => {
      const bob = await getUser("bob");
      const doris = await getUser("doris");
      const threadId = await bobDorisThreadId();
      const sent = await sendDMMessage(threadId, bob, "mine");
      if ("error" in sent) throw new Error(sent.error);
      const id = sent.messages.at(-1)!.messageId;
      expect(await deleteDMMessage(threadId, doris, id)).toEqual({
        error: "You can only delete your own messages",
      });
    });

    it("deletes the caller's own message", async () => {
      const bob = await getUser("bob");
      const threadId = await bobDorisThreadId();
      const sent = await sendDMMessage(threadId, bob, "mine");
      if ("error" in sent) throw new Error(sent.error);
      const id = sent.messages.at(-1)!.messageId;
      const after = await deleteDMMessage(threadId, bob, id);
      expect("error" in after).toBe(false);
      if (!("error" in after)) {
        expect(after.messages.find((m) => m.messageId === id)).toBeUndefined();
      }
    });
  });

  describe("getDMThread", () => {
    it("returns null for a missing thread", async () => {
      const bob = await getUser("bob");
      expect(await getDMThread("missing", bob)).toBeNull();
    });

    it("returns null for a non-participant", async () => {
      const u2 = await getUser("user2");
      expect(await getDMThread(await bobDorisThreadId(), u2)).toBeNull();
    });

    it("returns the thread for a participant", async () => {
      const bob = await getUser("bob");
      const threadId = await bobDorisThreadId();
      expect((await getDMThread(threadId, bob))?.threadId).toBe(threadId);
    });
  });

  describe("getDMThreadsForUser", () => {
    it("includes a thread with a current friend", async () => {
      const bob = await getUser("bob");
      expect((await getDMThreadsForUser(bob.userId)).length).toBeGreaterThanOrEqual(1);
    });

    it("excludes threads with people who are no longer friends", async () => {
      const bob = await getUser("bob");
      const friendship = (await getFriendships(bob.userId))[0];
      await removeFriendship(friendship.friendshipId, bob);
      expect(await getDMThreadsForUser(bob.userId)).toHaveLength(0);
    });
  });
});
