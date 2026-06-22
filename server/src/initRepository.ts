import { randomUUID } from "node:crypto";
import { getUserByUsername } from "./services/auth.service.ts";
import {
  AuthRepo,
  ChatRepo,
  CommentRepo,
  DMThreadRepo,
  FriendshipRepo,
  GameRepo,
  MessageRepo,
  ThreadRepo,
  UserRepo,
} from "./repository.ts";
import type { GameRecord, ThreadRecord } from "./models.ts";
import { createChat } from "./services/chat.service.ts";
import { createUser, updateUser } from "./services/user.service.ts";

/** Reset stored games with example data. */
async function resetStoredGames() {
  const user0id = (await getUserByUsername("user0"))!.userId;
  const user1id = (await getUserByUsername("user1"))!.userId;
  const user2id = (await getUserByUsername("user2"))!.userId;
  const user3id = (await getUserByUsername("user3"))!.userId;

  const recently = new Date(new Date().getTime() - 6 * 60 * 60 * 1000);
  const storedGames: { [key: string]: GameRecord } = {
    [randomUUID().toString()]: {
      type: "nim",
      state: { remaining: 0, nextPlayer: 1 },
      done: true,
      chat: (await createChat(new Date("2025-04-21"))).chatId,
      players: [user2id, user3id],
      createdAt: new Date("2025-04-21").toISOString(),
      createdBy: user2id,
    },
    [randomUUID().toString()]: {
      type: "guess",
      state: { secret: 43, guesses: [null, 2, 99, null] },
      done: false,
      chat: (await createChat(recently)).chatId,
      players: [user1id, user0id, user3id, user2id],
      createdAt: recently.toISOString(),
      createdBy: user1id,
    },
    [randomUUID().toString()]: {
      type: "nim",
      done: false,
      chat: (await createChat(new Date())).chatId,
      players: [user1id],
      createdAt: new Date().toISOString(),
      createdBy: user1id,
    },
  };

  await Promise.all(Object.entries(storedGames).map(([id, entry]) => GameRepo.set(id, entry)));
}

/** Reset stored threads with example data */
async function resetStoredThreads() {
  const user0id = (await getUserByUsername("user0"))!.userId;
  const user1id = (await getUserByUsername("user1"))!.userId;
  const user2id = (await getUserByUsername("user2"))!.userId;
  const user3id = (await getUserByUsername("user3"))!.userId;

  const storedThreads: { [key: string]: ThreadRecord } = {
    abadcafeabadcafeabadcafe: {
      createdBy: user1id,
      createdAt: new Date().toISOString(),
      title: "Nim?",
      text: "Is anyone around that wants to play Nim? I'll be here for the next hour or so.",
      comments: [],
    },
    deadbeefdeadbeefdeadbeef: {
      createdBy: user1id,
      createdAt: new Date("2025-04-02").toISOString(),
      title: "Hello game knights",
      text: "I'm a big Nim buff and am excited to join this community.",
      comments: [],
    },
    [randomUUID().toString()]: {
      createdBy: user3id,
      createdAt: new Date(new Date().getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      title: "Other games?",
      text: "Nim is great, but I'm hoping some new strategy games will get introduced soon.",
      comments: [],
    },
    [randomUUID().toString()]: {
      createdBy: user2id,
      createdAt: new Date("2025-04-04").toISOString(),
      title: "Strategy guide?",
      text: "I'm pretty confused about the right strategy for Nim, is there anyone around who can help explain this?",
      comments: [],
    },
    [randomUUID().toString()]: {
      createdBy: user0id,
      createdAt: new Date(new Date().getTime() - 1.5 * 24 * 60 * 60 * 1000).toISOString(),
      title: "New game: multiplayer number guesser!",
      text: "Strategy.town now has an exciting new game: guess! Try it out today: multiple people can join this exciting game, and guess a number between 1 and 100!",
      comments: [],
    },
  };
  await Promise.all(Object.entries(storedThreads).map(([id, entry]) => ThreadRepo.set(id, entry)));
}

/** Reset stored users with example data */
async function resetStoredUsers() {
  await createUser("user0", "pwd0000", new Date());
  await createUser("user1", "pwd1111", new Date());
  await createUser("user2", "pwd2222", new Date());
  await createUser("user3", "pwd3333", new Date());

  await updateUser("user0", { display: "The Knight Of Games" });
  await updateUser("user1", { display: "Yāo" });
  await updateUser("user2", { display: "Sénior Dos" });
  await updateUser("user3", { display: "Frau Drei" });

  // Two demo accounts with a real conversation, used to showcase the DM toast
  // and unread-count features (see resetStoredDMs).
  await createUser("bob", "cribbage-rematch", new Date());
  await createUser("doris", "24-point-crib", new Date());
  await updateUser("bob", { display: "Bob", accentColor: "#3f8cff" });
  await updateUser("doris", { display: "Doris", accentColor: "#e2574c" });

  // Friendly, human-named demo accounts used across the social UI and the
  // accessibility scans, so tests never sign up throwaway "userNNNN" accounts.
  await createUser("Bob", "pwdbob", new Date());
  await createUser("Emily", "pwdemily", new Date());
  await createUser("Hang", "pwdhang", new Date());
  await updateUser("Bob", { display: "Bob", bio: "I love video games!", accentColor: "#8b5cf6" });
  await updateUser("Emily", { display: "Emily", accentColor: "#f59e0b" });
  await updateUser("Hang", { display: "Hang Hang", accentColor: "#34d399" });
}

/**
 * Seed a meaningful DM conversation between the demo accounts Bob and Doris so
 * the direct-message toast + unread-count features can be showcased: log in as
 * each in a separate browser, and a new message from one shows a toast and a
 * per-conversation unread badge for the other.
 */
async function resetStoredDMs() {
  const bobId = (await getUserByUsername("bob"))!.userId;
  const dorisId = (await getUserByUsername("doris"))!.userId;

  const now = Date.now();
  const ago = (minutes: number) => new Date(now - minutes * 60 * 1000).toISOString();

  // DMs are friends-only, so make Bob and Doris accepted friends first.
  await FriendshipRepo.set(randomUUID().toString(), {
    fromUserId: bobId,
    toUserId: dorisId,
    status: "accepted",
    createdAt: ago(60 * 24 * 4),
    updatedAt: ago(60 * 24 * 4),
  });

  // Oldest first — the order the thread renders in.
  const script: { from: string; text: string; minutesAgo: number }[] = [
    {
      from: bobId,
      text: "Hey Doris! That Cribbage comeback last night was wild — how'd you pull it off?",
      minutesAgo: 140,
    },
    {
      from: dorisId,
      text: "Thanks Bob! Honestly that last hand was luck — I had a 24-point crib.",
      minutesAgo: 132,
    },
    { from: bobId, text: "24 in the crib?? That's brutal. Rematch tonight?", minutesAgo: 128 },
    {
      from: dorisId,
      text: "You're on. Best of three, and the loser writes the forum recap.",
      minutesAgo: 121,
    },
    { from: bobId, text: "Deal. Want to warm up with a quick round of Nim first?", minutesAgo: 96 },
    {
      from: dorisId,
      text: "Sure, start a table and I'll join. Normal rules or misère?",
      minutesAgo: 80,
    },
    {
      from: bobId,
      text: "Normal — last to take a stick wins. Give me a sec to set it up.",
      minutesAgo: 47,
    },
    { from: dorisId, text: "Grabbing a coffee, back in five.", minutesAgo: 9 },
    {
      from: dorisId,
      text: "Okay I'm back — send the invite whenever you're ready!",
      minutesAgo: 1,
    },
  ];

  const messageIds: string[] = [];
  for (const line of script) {
    const id = await MessageRepo.add({
      text: line.text,
      createdBy: line.from,
      createdAt: ago(line.minutesAgo),
    });
    messageIds.push(id);
  }

  await DMThreadRepo.set(randomUUID().toString(), {
    participants: [bobId, dorisId],
    messages: messageIds,
    createdAt: ago(140),
  });

  // A second conversation between the human-named demo accounts Bob and Emily,
  // so the messages UI always has a real thread to open.
  const bobUserId = (await getUserByUsername("Bob"))!.userId;
  const emilyId = (await getUserByUsername("Emily"))!.userId;
  await FriendshipRepo.set(randomUUID().toString(), {
    fromUserId: bobUserId,
    toUserId: emilyId,
    status: "accepted",
    createdAt: ago(60 * 24 * 2),
    updatedAt: ago(60 * 24 * 2),
  });
  const beScript: { from: string; text: string; minutesAgo: number }[] = [
    { from: bobUserId, text: "Hey Emily! Up for a game of Cribbage tonight?", minutesAgo: 30 },
    { from: emilyId, text: "Always — loser starts the next forum thread!", minutesAgo: 22 },
    { from: bobUserId, text: "Deal. I'll open a table in a few minutes.", minutesAgo: 8 },
  ];
  const beIds: string[] = [];
  for (const line of beScript) {
    beIds.push(
      await MessageRepo.add({
        text: line.text,
        createdBy: line.from,
        createdAt: ago(line.minutesAgo),
      }),
    );
  }
  await DMThreadRepo.set(randomUUID().toString(), {
    participants: [bobUserId, emilyId],
    messages: beIds,
    createdAt: ago(30),
  });
}

export async function resetEverythingToDefaults() {
  await AuthRepo.clear();
  await ChatRepo.clear();
  await CommentRepo.clear();
  await DMThreadRepo.clear();
  await FriendshipRepo.clear();
  await GameRepo.clear();
  await MessageRepo.clear();
  await ThreadRepo.clear();
  await UserRepo.clear();

  await resetStoredUsers();
  await resetStoredThreads();
  await resetStoredGames();
  await resetStoredDMs();
}
