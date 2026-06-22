import { describe, expect, it } from "vitest";
import supertest from "supertest";
import { app } from "../src/app.ts";

const user0 = { username: "user0", password: "pwd0000" };
const user1 = { username: "user1", password: "pwd1111" };
const bob = { username: "bob", password: "cribbage-rematch" };
const badAuth = { username: "user0", password: "nope" };

async function pendingFriendshipId(): Promise<string> {
  const res = await supertest(app)
    .post("/api/friend/request")
    .send({ auth: user0, payload: { toUsername: "user1" } });
  return res.body.friendshipId as string;
}

async function bobFriendshipId(): Promise<string> {
  const res = await supertest(app).get("/api/friend/list").query({ username: "bob" });
  return res.body[0].friendshipId as string;
}

describe("POST /api/friend/request", () => {
  it("400 on an ill-formed payload", async () => {
    const res = await supertest(app).post("/api/friend/request").send({ auth: user0, payload: 5 });
    expect(res.status).toBe(400);
  });

  it("403 on bad auth", async () => {
    const res = await supertest(app)
      .post("/api/friend/request")
      .send({ auth: badAuth, payload: { toUsername: "user1" } });
    expect(res.status).toBe(403);
  });

  it("400 when requesting yourself", async () => {
    const res = await supertest(app)
      .post("/api/friend/request")
      .send({ auth: user0, payload: { toUsername: "user0" } });
    expect(res.status).toBe(400);
  });

  it("200 sending a request to a stranger", async () => {
    const res = await supertest(app)
      .post("/api/friend/request")
      .send({ auth: user0, payload: { toUsername: "user1" } });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("pending");
  });
});

describe("POST /api/friend/:id (respond)", () => {
  it("200 when the recipient accepts", async () => {
    const id = await pendingFriendshipId();
    const res = await supertest(app)
      .post(`/api/friend/${id}`)
      .send({ auth: user1, payload: { friendshipId: id, status: "accepted" } });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("accepted");
  });

  it("400 when a non-recipient responds", async () => {
    const id = await pendingFriendshipId();
    const res = await supertest(app)
      .post(`/api/friend/${id}`)
      .send({ auth: user0, payload: { friendshipId: id, status: "accepted" } });
    expect(res.status).toBe(400);
  });

  it("403 on bad auth", async () => {
    const id = await pendingFriendshipId();
    const res = await supertest(app)
      .post(`/api/friend/${id}`)
      .send({ auth: badAuth, payload: { friendshipId: id, status: "accepted" } });
    expect(res.status).toBe(403);
  });

  it("400 on an ill-formed respond payload", async () => {
    const id = await pendingFriendshipId();
    const res = await supertest(app).post(`/api/friend/${id}`).send({ auth: user1, payload: 5 });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/friend/:id/remove", () => {
  it("200 un-friending an existing friendship", async () => {
    const id = await bobFriendshipId();
    const res = await supertest(app).post(`/api/friend/${id}/remove`).send({ auth: bob });
    expect(res.status).toBe(200);
  });

  it("403 on bad auth", async () => {
    const id = await bobFriendshipId();
    const res = await supertest(app).post(`/api/friend/${id}/remove`).send({ auth: badAuth });
    expect(res.status).toBe(403);
  });

  it("400 removing a friendship that doesn't exist", async () => {
    const res = await supertest(app).post("/api/friend/missing/remove").send({ auth: bob });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/friend/list", () => {
  it("400 without a username", async () => {
    const res = await supertest(app).get("/api/friend/list");
    expect(res.status).toBe(400);
  });

  it("404 for an unknown user", async () => {
    const res = await supertest(app).get("/api/friend/list").query({ username: "ghost" });
    expect(res.status).toBe(404);
  });

  it("200 listing a user's friendships", async () => {
    const res = await supertest(app).get("/api/friend/list").query({ username: "bob" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
