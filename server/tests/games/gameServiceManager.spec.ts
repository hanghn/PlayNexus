import { describe, it, expect } from "vitest";
import { gameServices } from "../../src/services/game.service.ts";

// gameServices.nim is a GameService instance, so exercising it covers the
// generic GameService wrapper in gameServiceManager.ts.
const nim = gameServices.nim;

describe("GameService (gameServiceManager)", () => {
  it("exposes the underlying game's player limits", () => {
    expect(nim.minPlayers).toBe(2);
    expect(nim.maxPlayers).toBe(2);
  });

  it("create returns an initial state plus views for players and watchers", () => {
    const { state, views } = nim.create(["a", "b"]);
    expect(state).toBeDefined();
    expect(views.players).toHaveLength(2);
    expect(views.watchers).toBeDefined();
  });

  it("update returns fresh views for a legal move and null for an illegal one", () => {
    const { state } = nim.create(["a", "b"]);
    const ok = nim.update(state, 1, 0, ["a", "b"]);
    expect(ok).not.toBeNull();
    expect(ok!.done).toBe(false);
    expect(nim.update(state, 999, 0, ["a", "b"])).toBeNull();
  });

  it("view returns a tagged view for a real state", () => {
    const { state } = nim.create(["a", "b"]);
    expect(nim.view(state, 0).type).toBe("nim");
  });

  it("view throws when the state is missing", () => {
    expect(() => nim.view(null, 0)).toThrow();
  });
});
