import { describe, it, expect } from "vitest";
import { getUserByUsername } from "../../src/services/auth.service.ts";
import {
  sendFriendRequest,
  updateFriendship,
  removeFriendship,
  areFriends,
  getFriendships,
} from "../../src/services/friend.service.ts";
import type { UserWithId } from "../../src/types.ts";

// The seed (setup.ts re-runs it before every test) creates Bob and Doris as
// accepted friends, and user0..user3 as unconnected strangers.
async function getUser(name: string): Promise<UserWithId> {
  const u = await getUserByUsername(name);
  if (!u) throw new Error(`seed user ${name} missing`);
  return u;
}

describe("friend.service", () => {
  describe("areFriends", () => {
    it("is true for the seeded Bob/Doris friendship", async () => {
      const bob = await getUser("bob");
      const doris = await getUser("doris");
      expect(await areFriends(bob.userId, doris.userId)).toBe(true);
    });

    it("is false for two strangers", async () => {
      const u0 = await getUser("user0");
      const u1 = await getUser("user1");
      expect(await areFriends(u0.userId, u1.userId)).toBe(false);
    });
  });

  describe("sendFriendRequest", () => {
    it("rejects a request to yourself", async () => {
      const u0 = await getUser("user0");
      expect(await sendFriendRequest(u0, "user0")).toEqual({ error: expect.any(String) });
    });

    it("rejects an unknown recipient", async () => {
      const u0 = await getUser("user0");
      expect(await sendFriendRequest(u0, "ghost")).toEqual({ error: "User not found" });
    });

    it("rejects when the two are already friends", async () => {
      const bob = await getUser("bob");
      expect(await sendFriendRequest(bob, "doris")).toEqual({ error: "You are already friends" });
    });

    it("creates a pending request between strangers", async () => {
      const u0 = await getUser("user0");
      const req = await sendFriendRequest(u0, "user1");
      expect("error" in req).toBe(false);
      if (!("error" in req)) expect(req.status).toBe("pending");
    });

    it("rejects a duplicate pending request", async () => {
      const u0 = await getUser("user0");
      await sendFriendRequest(u0, "user1");
      expect(await sendFriendRequest(u0, "user1")).toEqual({
        error: "A friend request is already pending",
      });
    });

    it("refuses a request once the recipient has blocked it", async () => {
      const u0 = await getUser("user0");
      const u1 = await getUser("user1");
      const req = await sendFriendRequest(u0, "user1");
      if ("error" in req) throw new Error(req.error);
      await updateFriendship(req.friendshipId, u1, "blocked");
      expect(await sendFriendRequest(u0, "user1")).toEqual({
        error: "Unable to send a friend request",
      });
    });

    it("re-opens a previously removed friendship as a fresh pending request", async () => {
      const bob = await getUser("bob");
      const friendship = (await getFriendships(bob.userId))[0];
      await removeFriendship(friendship.friendshipId, bob); // now "rejected"
      const reopened = await sendFriendRequest(bob, "doris");
      expect("error" in reopened).toBe(false);
      if (!("error" in reopened)) expect(reopened.status).toBe("pending");
    });
  });

  describe("updateFriendship", () => {
    it("errors on an unknown friendship", async () => {
      const u1 = await getUser("user1");
      expect(await updateFriendship("nope", u1, "accepted")).toEqual({
        error: "Friendship not found",
      });
    });

    it("only lets the recipient respond, then accepts", async () => {
      const u0 = await getUser("user0");
      const u1 = await getUser("user1");
      const req = await sendFriendRequest(u0, "user1");
      if ("error" in req) throw new Error(req.error);

      expect(await updateFriendship(req.friendshipId, u0, "accepted")).toEqual({
        error: "Only the recipient can respond",
      });
      const ok = await updateFriendship(req.friendshipId, u1, "accepted");
      expect("error" in ok).toBe(false);
      if (!("error" in ok)) expect(ok.status).toBe("accepted");
    });

    it("rejects responding to a request that is no longer pending", async () => {
      const u0 = await getUser("user0");
      const u1 = await getUser("user1");
      const req = await sendFriendRequest(u0, "user1");
      if ("error" in req) throw new Error(req.error);
      await updateFriendship(req.friendshipId, u1, "accepted");
      expect(await updateFriendship(req.friendshipId, u1, "rejected")).toEqual({
        error: "Request is no longer pending",
      });
    });
  });

  describe("removeFriendship", () => {
    it("errors on an unknown friendship", async () => {
      const bob = await getUser("bob");
      expect(await removeFriendship("nope", bob)).toEqual({ error: "Friendship not found" });
    });

    it("refuses when the actor isn't part of the friendship", async () => {
      const bob = await getUser("bob");
      const u2 = await getUser("user2");
      const friendship = (await getFriendships(bob.userId))[0];
      expect(await removeFriendship(friendship.friendshipId, u2)).toEqual({
        error: "Not your friendship",
      });
    });

    it("un-friends the pair (which disables their messaging)", async () => {
      const bob = await getUser("bob");
      const doris = await getUser("doris");
      const friendship = (await getFriendships(bob.userId))[0];
      const res = await removeFriendship(friendship.friendshipId, bob);
      expect("error" in res).toBe(false);
      expect(await areFriends(bob.userId, doris.userId)).toBe(false);
    });
  });

  describe("getFriendships", () => {
    it("finds the friendship from either side (sender and recipient)", async () => {
      const bob = await getUser("bob"); // the request sender in the seed
      const doris = await getUser("doris"); // the recipient
      expect((await getFriendships(bob.userId)).length).toBeGreaterThanOrEqual(1);
      expect((await getFriendships(doris.userId)).length).toBeGreaterThanOrEqual(1);
    });
  });
});
