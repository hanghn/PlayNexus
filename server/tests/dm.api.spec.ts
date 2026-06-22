import { describe, expect, it } from "vitest";
import supertest from "supertest";
import { app } from "../src/app.ts";

const bob = { username: "bob", password: "cribbage-rematch" };
const badAuth = { username: "bob", password: "wrong" };

/** Open (or fetch) the seeded Bob↔Doris thread and return its id. */
async function bobDorisThreadId(): Promise<string> {
  const res = await supertest(app)
    .post("/api/dm/open")
    .send({ auth: bob, payload: { withUsername: "doris" } });
  return res.body.threadId as string;
}

describe("POST /api/dm/open", () => {
  it("400 on an ill-formed payload", async () => {
    const res = await supertest(app).post("/api/dm/open").send({ auth: bob, payload: 5 });
    expect(res.status).toBe(400);
  });

  it("403 on bad auth", async () => {
    const res = await supertest(app)
      .post("/api/dm/open")
      .send({ auth: badAuth, payload: { withUsername: "doris" } });
    expect(res.status).toBe(403);
  });

  it("400 when messaging a non-friend", async () => {
    const res = await supertest(app)
      .post("/api/dm/open")
      .send({
        auth: { username: "user0", password: "pwd0000" },
        payload: { withUsername: "user1" },
      });
    expect(res.status).toBe(400);
  });

  it("200 opening a thread with a friend", async () => {
    const res = await supertest(app)
      .post("/api/dm/open")
      .send({ auth: bob, payload: { withUsername: "doris" } });
    expect(res.status).toBe(200);
    expect(res.body.participants).toHaveLength(2);
  });
});

describe("POST /api/dm/:id/message", () => {
  it("400 on an ill-formed payload", async () => {
    const id = await bobDorisThreadId();
    const res = await supertest(app)
      .post(`/api/dm/${id}/message`)
      .send({ auth: bob, payload: { text: 123 } });
    expect(res.status).toBe(400);
  });

  it("403 on bad auth", async () => {
    const id = await bobDorisThreadId();
    const res = await supertest(app)
      .post(`/api/dm/${id}/message`)
      .send({ auth: badAuth, payload: { threadId: id, text: "hi" } });
    expect(res.status).toBe(403);
  });

  it("400 when sending to a thread you're not in", async () => {
    const id = await bobDorisThreadId();
    const res = await supertest(app)
      .post(`/api/dm/${id}/message`)
      .send({
        auth: { username: "user2", password: "pwd2222" },
        payload: { threadId: id, text: "hi" },
      });
    expect(res.status).toBe(400);
  });

  it("200 sending a message as a participant", async () => {
    const id = await bobDorisThreadId();
    const res = await supertest(app)
      .post(`/api/dm/${id}/message`)
      .send({ auth: bob, payload: { threadId: id, text: "hello" } });
    expect(res.status).toBe(200);
  });
});

describe("GET /api/dm/:id", () => {
  it("403 without any auth", async () => {
    const id = await bobDorisThreadId();
    const res = await supertest(app).get(`/api/dm/${id}`);
    expect(res.status).toBe(403);
  });

  it("404 for a missing thread", async () => {
    const res = await supertest(app)
      .get("/api/dm/missing")
      .query({ username: "bob", password: "cribbage-rematch" });
    expect(res.status).toBe(404);
  });

  it("200 for a participant", async () => {
    const id = await bobDorisThreadId();
    const res = await supertest(app)
      .get(`/api/dm/${id}`)
      .query({ username: "bob", password: "cribbage-rematch" });
    expect(res.status).toBe(200);
    expect(res.body.threadId).toBe(id);
  });
});

describe("GET /api/dm/list", () => {
  it("400 without a username", async () => {
    const res = await supertest(app).get("/api/dm/list");
    expect(res.status).toBe(400);
  });

  it("404 for an unknown user", async () => {
    const res = await supertest(app).get("/api/dm/list").query({ username: "ghost" });
    expect(res.status).toBe(404);
  });

  it("200 listing a user's threads", async () => {
    const res = await supertest(app).get("/api/dm/list").query({ username: "bob" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
