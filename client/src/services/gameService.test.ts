// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGame,
  declineGameInvite,
  gameList,
  getGameById,
  getMyInvitations,
  sendGameInvite,
} from "./gameService.ts";
import { api } from "./api.ts";

vi.mock("./api.ts", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedGet = vi.mocked(api.get);
const mockedPost = vi.mocked(api.post);

const auth = { username: "alice", token: "tok" } as never;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("gameService", () => {
  describe("createGame", () => {
    it("posts to /api/game/create with defaults and returns data", async () => {
      const game = { id: "g1" };
      mockedPost.mockResolvedValueOnce({ data: game });

      const result = await createGame(auth, "cribbage");

      expect(result).toEqual(game);
      expect(mockedPost).toHaveBeenCalledWith("/api/game/create", {
        auth,
        payload: { type: "cribbage", singlePlayer: false, difficulty: undefined },
      });
    });

    it("forwards singlePlayer and difficulty", async () => {
      mockedPost.mockResolvedValueOnce({ data: { id: "g2" } });

      await createGame(auth, "cribbage", true, "hard");

      expect(mockedPost).toHaveBeenCalledWith("/api/game/create", {
        auth,
        payload: { type: "cribbage", singlePlayer: true, difficulty: "hard" },
      });
    });

    it("throws when the response is an error message", async () => {
      mockedPost.mockResolvedValueOnce({ data: { error: "boom" } });

      await expect(createGame(auth, "cribbage")).rejects.toThrow("boom");
    });
  });

  describe("sendGameInvite", () => {
    it("posts to /api/game/invite and returns data", async () => {
      const invite = { gameId: "g1", toUsername: "bob" };
      mockedPost.mockResolvedValueOnce({ data: invite });

      const result = await sendGameInvite(auth, "bob", "g1");

      expect(result).toEqual(invite);
      expect(mockedPost).toHaveBeenCalledWith("/api/game/invite", {
        auth,
        payload: { toUsername: "bob", gameId: "g1" },
      });
    });

    it("throws on error response", async () => {
      mockedPost.mockResolvedValueOnce({ data: { error: "no friend" } });

      await expect(sendGameInvite(auth, "bob", "g1")).rejects.toThrow("no friend");
    });
  });

  describe("getMyInvitations", () => {
    it("gets /api/game/invite/list with username param", async () => {
      const list = [{ gameId: "g1" }];
      mockedGet.mockResolvedValueOnce({ data: list });

      const result = await getMyInvitations("alice");

      expect(result).toEqual(list);
      expect(mockedGet).toHaveBeenCalledWith("/api/game/invite/list", {
        params: { username: "alice" },
      });
    });

    it("throws on error response", async () => {
      mockedGet.mockResolvedValueOnce({ data: { error: "nope" } });

      await expect(getMyInvitations("alice")).rejects.toThrow("nope");
    });
  });

  describe("declineGameInvite", () => {
    it("posts to /api/game/invite/decline and returns data", async () => {
      const declined = { gameId: "g1", declinedBy: "bob" };
      mockedPost.mockResolvedValueOnce({ data: declined });

      const result = await declineGameInvite(auth, "g1", "carol");

      expect(result).toEqual(declined);
      expect(mockedPost).toHaveBeenCalledWith("/api/game/invite/decline", {
        auth,
        payload: { gameId: "g1", inviterUsername: "carol" },
      });
    });

    it("throws on error response", async () => {
      mockedPost.mockResolvedValueOnce({ data: { error: "fail" } });

      await expect(declineGameInvite(auth, "g1", "carol")).rejects.toThrow("fail");
    });
  });

  describe("getGameById", () => {
    it("gets /api/game/:id and returns data", async () => {
      const game = { id: "g7" };
      mockedGet.mockResolvedValueOnce({ data: game });

      const result = await getGameById("g7");

      expect(result).toEqual(game);
      expect(mockedGet).toHaveBeenCalledWith("/api/game/g7");
    });

    it("throws on error response", async () => {
      mockedGet.mockResolvedValueOnce({ data: { error: "missing" } });

      await expect(getGameById("g7")).rejects.toThrow("missing");
    });
  });

  describe("gameList", () => {
    it("gets /api/game/list and returns data", async () => {
      const list = [{ id: "g1" }, { id: "g2" }];
      mockedGet.mockResolvedValueOnce({ data: list });

      const result = await gameList();

      expect(result).toEqual(list);
      expect(mockedGet).toHaveBeenCalledWith("/api/game/list");
    });

    it("throws on error response", async () => {
      mockedGet.mockResolvedValueOnce({ data: { error: "down" } });

      await expect(gameList()).rejects.toThrow("down");
    });
  });
});
