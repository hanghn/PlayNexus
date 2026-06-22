/* eslint no-console: "off" */

import express, { Router } from "express";
import { Server } from "socket.io";
import { z } from "zod";
import * as http from "node:http";
import * as chat from "./controllers/chat.controller.ts";
import * as dm from "./controllers/dm.controller.ts";
import * as friend from "./controllers/friend.controller.ts";
import * as game from "./controllers/game.controller.ts";
import * as user from "./controllers/user.controller.ts";
import * as thread from "./controllers/thread.controller.ts";
import { setSocketServer } from "./controllers/socket.controller.ts";
import { attachSession, requireSession } from "./middleware/session.middleware.ts";
import { sessionUserFromCookies } from "./services/session.service.ts";
import { type GameServer } from "./types.ts";

export const app = express();
export const httpServer = http.createServer(app);
const io: GameServer = new Server(httpServer, {
  pingInterval: 10000, // check every 10s (default: 25s)
  pingTimeout: 5000, // mark disconnected after 5s no-pong (default: 20s)
});
// Expose the socket server to REST controllers (e.g. live friend-request pushes)
setSocketServer(io);

// Track online users: username → set of connected socket IDs.
// Using a Set (not a counter) makes multiple userOnline emits from the same
// socket idempotent, which prevents React StrictMode double-invoke from
// inflating the count and leaving users permanently "online".
const onlineUsers = new Map<string, Set<string>>();

app.use(express.json());

// Resolve a session cookie (if any) into req.session for every API request, so
// routes can check the caller's cookie against the sessions table (COS 2.5).
app.use(attachSession);

app.use(
  "/api",
  Router()
    .use(
      "/game",
      express
        .Router() //
        .post("/create", game.postCreate)
        .post("/invite", game.postInvite)
        .post("/invite/decline", game.postInviteDecline)
        .get("/invite/list", game.getInviteList)
        .get("/list", game.getList)
        .get("/:id", game.getById),
    )
    .use(
      "/thread",
      express
        .Router() //
        .post("/create", thread.postCreate)
        .get("/list", thread.getList)
        .get("/:id", thread.getById)
        .post("/:id/comment/:commentId/delete", thread.postCommentDelete)
        .post("/:id/comment", thread.postByIdComment),
    )
    .use(
      "/user",
      Router() // Any concrete routes here should be disallowed as usernames
        .post("/list", user.postList)
        .post("/login", user.postLogin)
        .post("/login/verify", user.postLoginVerify)
        .post("/logout", user.postLogout)
        .post("/signup", user.postSignup)
        .get("/me", requireSession, user.getMe)
        .get("/mfa", requireSession, user.getMfa)
        .post("/mfa/enroll", requireSession, user.postMfaEnroll)
        .post("/mfa/verify", requireSession, user.postMfaVerify)
        .post("/mfa/disable", requireSession, user.postMfaDisable)
        .get("/security", requireSession, user.getSecurity)
        .post("/security/remember", requireSession, user.postRemember)
        .post("/security/revoke-all", requireSession, user.postRevokeAllSessions)
        .post("/:username", user.postByUsername)
        .get("/:username", user.getByUsername),
    )
    .use(
      "/friend",
      Router()
        .get("/list", friend.getList)
        .post("/request", friend.postRequest)
        .post("/:id/remove", friend.postRemove)
        .post("/:id", friend.postById),
    )
    .use(
      "/dm",
      Router()
        .get("/list", dm.getList)
        .post("/open", dm.postOpen)
        .get("/:id", dm.getById)
        .post("/:id/message", dm.postMessage),
    ),
);

io.on("connection", (socket) => {
  const socketId = socket.id;
  console.log(`CONN [${socketId}] connected`);

  // Resolve the session from the handshake cookie once per connection and cache the promise on the socket
  socket.data.sessionUser = sessionUserFromCookies(socket.handshake.headers.cookie);
  socket.emit("onlineUsers", Array.from(onlineUsers.keys()));
  socket.on("disconnect", () => {
    console.log(`CONN [${socketId}] disconnected`);
    const username = socket.data.username;
    if (username) {
      const sockets = onlineUsers.get(username);
      if (sockets) {
        sockets.delete(socketId);
        if (sockets.size === 0) onlineUsers.delete(username);
      }
      io.emit("onlineUsers", Array.from(onlineUsers.keys()));
    }
  });

  socket.on("chatJoin", chat.socketJoin(socket, io));
  socket.on("chatLeave", chat.socketLeave(socket, io));
  socket.on("chatSendMessage", chat.socketSendMessage(socket, io));
  socket.on("chatDeleteMessage", chat.socketDeleteMessage(socket, io));

  socket.on("dmJoin", dm.socketJoin(socket, io));
  socket.on("dmLeave", dm.socketLeave(socket, io));
  socket.on("dmSendMessage", dm.socketSendMessage(socket, io));
  socket.on("dmDeleteMessage", dm.socketDeleteMessage(socket, io));

  socket.on("gameJoinAsPlayer", game.socketJoinAsPlayer(socket, io));
  socket.on("gameLeave", game.socketLeaveGame(socket, io));
  socket.on("gameMakeMove", game.socketMakeMove(socket, io));
  socket.on("gameStart", game.socketStart(socket, io));
  socket.on("gameWatch", game.socketWatch(socket, io));

  socket.onAny((name, payload) => {
    const zPayload = z.object({ auth: z.object({ username: z.string() }), payload: z.any() });
    const checked = zPayload.safeParse(payload);

    if (checked.error) {
      console.log(`RECV error: ${checked.error.message}`);
    } else {
      console.log(
        `RECV [${socketId}] got ${name}${checked.data.auth.username} ${JSON.stringify(checked.data.payload)}`,
      );
    }
  });
  // When a client notifies that a user is online, track it and broadcast list
  socket.on("userOnline", ({ auth }: { auth: { username: string } }) => {
    try {
      const username = auth.username;
      // store username on the socket for disconnect handling
      socket.data.username = username;
      // Join a personal room so the user can be notified of DMs/events even when
      // they aren't currently in the relevant thread room.
      void socket.join(`user:${username}`);

      const sockets = onlineUsers.get(username) ?? new Set<string>();
      sockets.add(socketId);
      onlineUsers.set(username, sockets);
      io.emit("onlineUsers", Array.from(onlineUsers.keys()));
    } catch (e) {
      console.log("userOnline handler error", e);
    }
  });
  // Client asks for a fresh snapshot (e.g. after navigating back to a page).
  socket.on("getOnlineUsers", () => {
    socket.emit("onlineUsers", Array.from(onlineUsers.keys()));
  });

  socket.onAnyOutgoing((name) => {
    console.log(`SEND [${socketId}] gets ${name}`);
  });
});
