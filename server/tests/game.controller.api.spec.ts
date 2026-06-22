import { describe, expect, it } from "vitest";
import supertest from "supertest";
import { app } from "../src/app.ts";

const user0 = { username: "user0", password: "pwd0000" };
const user1 = { username: "user1", password: "pwd1111" };
const badAuth = { username: "user0", password: "no" };

async function createNimGame(): Promise<string> {
  const res = await supertest(app)
    .post("/api/game/create")
    .send({ auth: user0, payload: { type: "nim" } });
  return res.body.gameId as string;
}

describe("POST /api/game/invite", () => {
  it("400 on an ill-formed payload", async () => {
    const res = await supertest(app).post("/api/game/invite").send({ auth: user0, payload: 5 });
    expect(res.status).toBe(400);
  });

  it("403 on bad auth", async () => {
    const gameId = await createNimGame();
    const res = await supertest(app)
      .post("/api/game/invite")
      .send({ auth: badAuth, payload: { gameId, toUsername: "user1" } });
    expect(res.status).toBe(403);
  });

  it("404 when the invitee doesn't exist", async () => {
    const gameId = await createNimGame();
    const res = await supertest(app)
      .post("/api/game/invite")
      .send({ auth: user0, payload: { gameId, toUsername: "ghost" } });
    expect(res.status).toBe(404);
  });

  it("404 when the game doesn't exist", async () => {
    const res = await supertest(app)
      .post("/api/game/invite")
      .send({ auth: user0, payload: { gameId: "missing", toUsername: "user1" } });
    expect(res.status).toBe(404);
  });

  it("200 inviting a user to a game", async () => {
    const gameId = await createNimGame();
    const res = await supertest(app)
      .post("/api/game/invite")
      .send({ auth: user0, payload: { gameId, toUsername: "user1" } });
    expect(res.status).toBe(200);
  });
});

describe("GET /api/game/invite/list", () => {
  it("400 without a username", async () => {
    const res = await supertest(app).get("/api/game/invite/list");
    expect(res.status).toBe(400);
  });

  it("200 listing invites for a user", async () => {
    const gameId = await createNimGame();
    await supertest(app)
      .post("/api/game/invite")
      .send({ auth: user0, payload: { gameId, toUsername: "user1" } });
    const res = await supertest(app).get("/api/game/invite/list").query({ username: "user1" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("POST /api/game/invite/decline", () => {
  it("400 on an ill-formed payload", async () => {
    const res = await supertest(app)
      .post("/api/game/invite/decline")
      .send({ auth: user0, payload: 5 });
    expect(res.status).toBe(400);
  });

  it("403 on bad auth", async () => {
    const res = await supertest(app)
      .post("/api/game/invite/decline")
      .send({ auth: badAuth, payload: { gameId: "g", inviterUsername: "user0" } });
    expect(res.status).toBe(403);
  });

  it("404 when the game doesn't exist", async () => {
    const res = await supertest(app)
      .post("/api/game/invite/decline")
      .send({ auth: user1, payload: { gameId: "missing", inviterUsername: "user0" } });
    expect(res.status).toBe(404);
  });

  it("200 declining an invite", async () => {
    const gameId = await createNimGame();
    await supertest(app)
      .post("/api/game/invite")
      .send({ auth: user0, payload: { gameId, toUsername: "user1" } });
    const res = await supertest(app)
      .post("/api/game/invite/decline")
      .send({ auth: user1, payload: { gameId, inviterUsername: "user0" } });
    expect(res.status).toBe(200);
  });
});

describe("GET /api/game/:id and /api/game/list", () => {
  it("404 for an unknown game", async () => {
    const res = await supertest(app).get("/api/game/missing");
    expect(res.status).toBe(404);
  });

  it("200 fetching a game by id", async () => {
    const gameId = await createNimGame();
    const res = await supertest(app).get(`/api/game/${gameId}`);
    expect(res.status).toBe(200);
    expect(res.body.gameId).toBe(gameId);
  });

  it("200 listing all games", async () => {
    await createNimGame();
    const res = await supertest(app).get("/api/game/list");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
