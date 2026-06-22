import { describe, it, expect } from "vitest";
import { getUserByUsername } from "../../src/services/auth.service.ts";
import { populateSafeUserInfo } from "../../src/services/user.service.ts";
import {
  createGame,
  getGameById,
  joinGame,
  leaveGame,
  startGame,
  getGames,
  updateGame,
  viewGame,
  storeInvitation,
  removeInvitation,
  getInvitationsForUser,
  applyAIMoves,
} from "../../src/services/game.service.ts";
import { GameRepo } from "../../src/repository.ts";
import { AI_EASY_PLAYER_ID } from "../../src/games/cribbageAI.ts";
import type { UserWithId } from "../../src/types.ts";

async function getUser(name: string): Promise<UserWithId> {
  const u = await getUserByUsername(name);
  if (!u) throw new Error(`seed user ${name} missing`);
  return u;
}

/** Create a 2-player Nim game that's started and ready for moves. */
async function startedNim() {
  const u0 = await getUser("user0");
  const u1 = await getUser("user1");
  const game = await createGame(u0, "nim", new Date());
  await joinGame(game.gameId, u1);
  await startGame(game.gameId, u0);
  return { gameId: game.gameId, u0, u1 };
}

describe("game.service", () => {
  describe("createGame", () => {
    it("creates a 2-player game in the waiting state", async () => {
      const game = await createGame(await getUser("user0"), "nim", new Date());
      expect(game.status).toBe("waiting");
      expect(game.players).toHaveLength(1);
    });

    it("auto-starts a single-player cribbage game against the AI", async () => {
      const game = await createGame(await getUser("user0"), "cribbage", new Date(), true, "easy");
      expect(game.status).toBe("active");
      expect(game.players).toHaveLength(2);
    });

    it("runs the AI's follow-up moves after a human move (single-player cribbage)", async () => {
      const u0 = await getUser("user0");
      const game = await createGame(u0, "cribbage", new Date(), true, "easy");
      // Human cuts for the deal; updateGame then drives the AI via applyAIMoves.
      const views = await updateGame(game.gameId, u0, { type: "cut", index: 0 });
      expect(views).toBeTruthy();
      expect((await viewGame(game.gameId, u0)).isPlayer).toBe(true);
    });
  });

  describe("getGameById", () => {
    it("returns null for an unknown id", async () => {
      expect(await getGameById("nope")).toBeNull();
    });

    it("returns the game for a valid id", async () => {
      const created = await createGame(await getUser("user0"), "nim", new Date());
      expect((await getGameById(created.gameId))?.gameId).toBe(created.gameId);
    });
  });

  describe("joinGame", () => {
    it("throws for an invalid game", async () => {
      await expect(joinGame("nope", await getUser("user0"))).rejects.toThrow();
    });

    it("lets a second player join", async () => {
      const u0 = await getUser("user0");
      const game = await createGame(u0, "nim", new Date());
      const joined = await joinGame(game.gameId, await getUser("user1"));
      expect(joined.players).toHaveLength(2);
    });

    it("throws when a player joins twice", async () => {
      const u0 = await getUser("user0");
      const game = await createGame(u0, "nim", new Date());
      await expect(joinGame(game.gameId, u0)).rejects.toThrow();
    });

    it("throws when the game is already full", async () => {
      const u0 = await getUser("user0");
      const game = await createGame(u0, "nim", new Date());
      await joinGame(game.gameId, await getUser("user1")); // full (max 2)
      await expect(joinGame(game.gameId, await getUser("user2"))).rejects.toThrow();
    });

    it("throws when joining a game that already started", async () => {
      const { gameId } = await startedNim();
      await expect(joinGame(gameId, await getUser("user2"))).rejects.toThrow();
    });
  });

  describe("startGame", () => {
    it("throws for an invalid game", async () => {
      await expect(startGame("nope", await getUser("user0"))).rejects.toThrow();
    });

    it("throws when the game is underpopulated", async () => {
      const u0 = await getUser("user0");
      const game = await createGame(u0, "nim", new Date());
      await expect(startGame(game.gameId, u0)).rejects.toThrow();
    });

    it("throws when the starter isn't a player", async () => {
      const u0 = await getUser("user0");
      const game = await createGame(u0, "nim", new Date());
      await joinGame(game.gameId, await getUser("user1"));
      await expect(startGame(game.gameId, await getUser("user2"))).rejects.toThrow();
    });

    it("starts a fully-populated game", async () => {
      const { gameId } = await startedNim();
      expect((await getGameById(gameId))?.status).toBe("active");
    });

    it("throws when starting an already-started game", async () => {
      const { gameId, u0 } = await startedNim();
      await expect(startGame(gameId, u0)).rejects.toThrow();
    });
  });

  describe("leaveGame", () => {
    it("throws for an invalid game", async () => {
      await expect(leaveGame("nope", await getUser("user0"))).rejects.toThrow();
    });

    it("throws when the user isn't a player", async () => {
      const u0 = await getUser("user0");
      const game = await createGame(u0, "nim", new Date());
      await expect(leaveGame(game.gameId, await getUser("user2"))).rejects.toThrow();
    });

    it("removes a player from a not-started lobby", async () => {
      const u0 = await getUser("user0");
      const u1 = await getUser("user1");
      const game = await createGame(u0, "nim", new Date());
      await joinGame(game.gameId, u1);
      await leaveGame(game.gameId, u1);
      expect((await getGameById(game.gameId))?.players).toHaveLength(1);
    });

    it("abandons an in-progress game (marks it done)", async () => {
      const { gameId, u0 } = await startedNim();
      await leaveGame(gameId, u0);
      expect((await getGameById(gameId))?.status).toBe("done");
    });
  });

  describe("updateGame", () => {
    it("throws on an invalid game", async () => {
      await expect(updateGame("nope", await getUser("user0"), 1)).rejects.toThrow();
    });

    it("throws when the game hasn't started", async () => {
      const u0 = await getUser("user0");
      const game = await createGame(u0, "nim", new Date());
      await expect(updateGame(game.gameId, u0, 1)).rejects.toThrow();
    });

    it("throws when a non-player makes a move", async () => {
      const { gameId } = await startedNim();
      await expect(updateGame(gameId, await getUser("user2"), 1)).rejects.toThrow();
    });

    it("throws on an illegal move", async () => {
      const { gameId, u0 } = await startedNim();
      await expect(updateGame(gameId, u0, 99)).rejects.toThrow();
    });

    it("applies a legal move and returns view updates", async () => {
      const { gameId, u0 } = await startedNim();
      const views = await updateGame(gameId, u0, 1);
      expect(views).toBeTruthy();
    });
  });

  describe("viewGame", () => {
    it("throws for an invalid game", async () => {
      await expect(viewGame("nope", await getUser("user0"))).rejects.toThrow();
    });

    it("distinguishes a player (with a view) from a watcher", async () => {
      const { gameId, u0 } = await startedNim();
      const asPlayer = await viewGame(gameId, u0);
      expect(asPlayer.isPlayer).toBe(true);
      expect(asPlayer.view).not.toBeNull();

      const asWatcher = await viewGame(gameId, await getUser("user2"));
      expect(asWatcher.isPlayer).toBe(false);
    });
  });

  describe("getGames", () => {
    it("lists created games", async () => {
      await createGame(await getUser("user0"), "nim", new Date());
      expect((await getGames()).length).toBeGreaterThanOrEqual(1);
    });

    it("returns an empty list when there are no games", async () => {
      await GameRepo.clear();
      expect(await getGames()).toEqual([]);
    });
  });

  describe("applyAIMoves", () => {
    it("is a no-op for a missing game", async () => {
      expect(await applyAIMoves("missing")).toBeNull();
    });

    it("is a no-op for a multiplayer (non-AI) game", async () => {
      const { gameId } = await startedNim();
      expect(await applyAIMoves(gameId)).toBeNull();
    });

    it("is a no-op when the single-player game is already done", async () => {
      const game = await createGame(await getUser("user0"), "cribbage", new Date(), true, "easy");
      const rec = await GameRepo.get(game.gameId);
      rec.done = true;
      await GameRepo.set(game.gameId, rec);
      expect(await applyAIMoves(game.gameId)).toBeNull();
    });

    it("is a no-op when the single-player game has no state yet", async () => {
      const game = await createGame(await getUser("user0"), "cribbage", new Date(), true, "easy");
      const rec = await GameRepo.get(game.gameId);
      rec.state = undefined;
      await GameRepo.set(game.gameId, rec);
      expect(await applyAIMoves(game.gameId)).toBeNull();
    });

    it("is a no-op when a single-player game has no AI player", async () => {
      const game = await createGame(await getUser("user0"), "cribbage", new Date(), true, "easy");
      const u1 = await getUser("user1");
      const rec = await GameRepo.get(game.gameId);
      // Replace the AI seat with a human so players.find(isAIPlayer) is undefined.
      rec.players = [rec.players[0], u1.userId];
      await GameRepo.set(game.gameId, rec);
      expect(await applyAIMoves(game.gameId)).toBeNull();
    });

    it("is a no-op when a single-player game's type is not cribbage", async () => {
      // Craft an impossible-via-normal-flow record: a started Nim game flagged
      // single-player with an AI seat. applyAIMoves passes the early guards, then
      // bails at the `tagged.type !== "cribbage"` check.
      const { gameId } = await startedNim();
      const rec = await GameRepo.get(gameId);
      rec.singlePlayer = true;
      rec.players = [rec.players[0], AI_EASY_PLAYER_ID];
      await GameRepo.set(gameId, rec);
      expect(await applyAIMoves(gameId)).toBeNull();
    });

    it("drives a single-player hand, exercising the AI follow-up and no-op return paths", async () => {
      const u0 = await getUser("user0");
      const { gameId } = await createGame(u0, "cribbage", new Date(), true, "easy");
      const cardValue = (rank: number) => Math.min(rank, 10);

      // Play the human's side of a full hand. When the AI follows a human move,
      // updateGame returns its views; when a human play leaves the AI nothing to
      // do, applyAIMoves returns null. cut / ready / discard are per-player (not
      // turn-gated); play is turn-gated.
      let enteredPlay = false;
      for (let i = 0; i < 80; i += 1) {
        const { view } = await viewGame(gameId, u0);
        if (!view || view.type !== "cribbage") break;
        const v = view.view;
        if (v.phase === "play") enteredPlay = true;
        if (v.phase === "show" || v.phase === "handover" || v.phase === "done") break;
        let move: unknown;
        if (v.phase === "cut") move = { type: "cut", index: 0 };
        else if (v.phase === "deal") move = { type: "ready" };
        else if (v.phase === "discard")
          move = { type: "discard", cards: [v.myHand[0], v.myHand[1]] };
        else {
          // Play is turn-gated; if it isn't our turn the AI had nothing to do, so stop.
          if (v.nextPlayer !== v.myIndex) break;
          const playable = v.myHand.filter((c) => cardValue(c.rank) <= 31 - v.runningCount);
          move = playable.length === 0 ? { type: "go" } : { type: "play", card: playable[0] };
        }
        await updateGame(gameId, u0, move);
      }
      // Both players discarded and pegging began.
      expect(enteredPlay).toBe(true);
    });
  });

  describe("invitations", () => {
    it("stores, lists, and removes a pending invitation", async () => {
      const u0 = await getUser("user0");
      const game = await createGame(u0, "nim", new Date());
      const from = await populateSafeUserInfo(u0.userId);
      storeInvitation({
        gameId: game.gameId,
        gameType: "nim",
        from,
        toUsername: "user1",
        createdAt: new Date(),
      });
      expect((await getInvitationsForUser("user1")).some((i) => i.gameId === game.gameId)).toBe(
        true,
      );

      removeInvitation(game.gameId, "user1");
      expect((await getInvitationsForUser("user1")).some((i) => i.gameId === game.gameId)).toBe(
        false,
      );
    });

    it("prunes an invitation once its game is no longer waiting", async () => {
      const u0 = await getUser("user0");
      const game = await createGame(u0, "nim", new Date());
      const from = await populateSafeUserInfo(u0.userId);
      storeInvitation({
        gameId: game.gameId,
        gameType: "nim",
        from,
        toUsername: "user2",
        createdAt: new Date(),
      });
      await joinGame(game.gameId, await getUser("user1"));
      await startGame(game.gameId, u0); // now active, not waiting
      expect((await getInvitationsForUser("user2")).some((i) => i.gameId === game.gameId)).toBe(
        false,
      );
    });
  });
});
