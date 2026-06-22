import { describe, expect, it } from "vitest";
import supertest from "supertest";
import { app } from "../src/app.ts";

const user0 = { username: "user0", password: "pwd0000" };
const user1 = { username: "user1", password: "pwd1111" };
const badAuth = { username: "user0", password: "no" };

async function newThread(): Promise<string> {
  const res = await supertest(app)
    .post("/api/thread/create")
    .send({ auth: user0, payload: { title: "T", text: "b" } });
  return res.body.threadId as string;
}

async function addComment(threadId: string, auth = user0): Promise<string> {
  const res = await supertest(app)
    .post(`/api/thread/${threadId}/comment`)
    .send({ auth, payload: "a comment" });
  const comments = (res.body as { comments: { commentId: string }[] }).comments;
  return comments[comments.length - 1].commentId;
}

describe("GET /api/thread/list and /api/thread/:id", () => {
  it("200 listing threads", async () => {
    const res = await supertest(app).get("/api/thread/list");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("404 for an unknown thread", async () => {
    expect((await supertest(app).get("/api/thread/missing")).status).toBe(404);
  });

  it("200 fetching a thread by id", async () => {
    const id = await newThread();
    const res = await supertest(app).get(`/api/thread/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.threadId).toBe(id);
  });
});

describe("POST /api/thread/create", () => {
  it("400 on an ill-formed payload", async () => {
    expect(
      (await supertest(app).post("/api/thread/create").send({ auth: user0, payload: 5 })).status,
    ).toBe(400);
  });

  it("403 on bad auth", async () => {
    const res = await supertest(app)
      .post("/api/thread/create")
      .send({ auth: badAuth, payload: { title: "T", text: "b" } });
    expect(res.status).toBe(403);
  });

  it("200 creating a thread", async () => {
    const res = await supertest(app)
      .post("/api/thread/create")
      .send({ auth: user0, payload: { title: "T", text: "b" } });
    expect(res.status).toBe(200);
  });
});

describe("POST /api/thread/:id/comment", () => {
  it("400 on an ill-formed payload", async () => {
    const id = await newThread();
    const res = await supertest(app)
      .post(`/api/thread/${id}/comment`)
      .send({ auth: user0, payload: 5 });
    expect(res.status).toBe(400);
  });

  it("403 on bad auth", async () => {
    const id = await newThread();
    const res = await supertest(app)
      .post(`/api/thread/${id}/comment`)
      .send({ auth: badAuth, payload: "hi" });
    expect(res.status).toBe(403);
  });

  it("404 commenting on a missing thread", async () => {
    const res = await supertest(app)
      .post("/api/thread/missing/comment")
      .send({ auth: user0, payload: "hi" });
    expect(res.status).toBe(404);
  });

  it("200 adding a comment", async () => {
    const id = await newThread();
    const res = await supertest(app)
      .post(`/api/thread/${id}/comment`)
      .send({ auth: user0, payload: "nice" });
    expect(res.status).toBe(200);
    expect(res.body.comments).toHaveLength(1);
  });
});

describe("POST /api/thread/:id/comment/:commentId/delete", () => {
  it("403 on bad auth", async () => {
    const id = await newThread();
    const commentId = await addComment(id);
    const res = await supertest(app)
      .post(`/api/thread/${id}/comment/${commentId}/delete`)
      .send({ auth: badAuth });
    expect(res.status).toBe(403);
  });

  it("404 for a missing thread", async () => {
    const res = await supertest(app)
      .post("/api/thread/missing/comment/c/delete")
      .send({ auth: user0 });
    expect(res.status).toBe(404);
  });

  it("400 deleting another user's comment", async () => {
    const id = await newThread();
    const commentId = await addComment(id, user1);
    const res = await supertest(app)
      .post(`/api/thread/${id}/comment/${commentId}/delete`)
      .send({ auth: user0 });
    expect(res.status).toBe(400);
  });

  it("200 deleting your own comment", async () => {
    const id = await newThread();
    const commentId = await addComment(id, user0);
    const res = await supertest(app)
      .post(`/api/thread/${id}/comment/${commentId}/delete`)
      .send({ auth: user0 });
    expect(res.status).toBe(200);
  });
});
