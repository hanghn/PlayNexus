import { describe, expect, it, vi } from "vitest";
import supertest from "supertest";

// Force createGame to throw so the postCreate controller's catch (the
// "couldn't create the game" 400 path) is exercised. Everything else in the
// game service stays real.
vi.mock(import("../src/services/game.service.ts"), async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    createGame: vi.fn().mockRejectedValue(new Error("one game at a time")),
  };
});

const { app } = await import("../src/app.ts");
const { createGame } = await import("../src/services/game.service.ts");
const user0 = { username: "user0", password: "pwd0000" };

describe("POST /api/game/create when creation fails", () => {
  it("returns 400 with the failure message", async () => {
    const res = await supertest(app)
      .post("/api/game/create")
      .send({ auth: user0, payload: { type: "nim" } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("one game at a time");
  });

  it("falls back to a generic message when the thrown value is not an Error", async () => {
    vi.mocked(createGame).mockRejectedValueOnce("not an Error object");
    const res = await supertest(app)
      .post("/api/game/create")
      .send({ auth: user0, payload: { type: "nim" } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Could not create game.");
  });
});
