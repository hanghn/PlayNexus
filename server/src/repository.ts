import { createRepo } from "./keyv.ts";
import type {
  AuthRecord,
  ChatRecord,
  CommentRecord,
  DMThreadRecord,
  FriendshipRecord,
  GameRecord,
  MessageRecord,
  ThreadRecord,
  UserRecord,
} from "./models.ts";

export const AuthRepo = createRepo<AuthRecord>("auth");
export const ChatRepo = createRepo<ChatRecord>("chat");
export const CommentRepo = createRepo<CommentRecord>("comment");
export const DMThreadRepo = createRepo<DMThreadRecord>("dmthread");
export const FriendshipRepo = createRepo<FriendshipRecord>("friendship");
export const GameRepo = createRepo<GameRecord>("game");
export const MessageRepo = createRepo<MessageRecord>("message");
export const ThreadRepo = createRepo<ThreadRecord>("thread");
export const UserRepo = createRepo<UserRecord>("user");
