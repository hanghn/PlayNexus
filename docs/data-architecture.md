# PlayNexus — Data Architecture

PlayNexus persists all application data through a single keyv repository
abstraction backed by **Supabase Postgres** (the `playnexus_kv` store), with
**`sessions`** and **`otpChallenges`** kept in dedicated tables that have
**row-level security enabled** and are reachable only via the service-role
key. The schema centers on the **User** entity, around which four domains are
organized: identity & security, social, forum, and games.

> Crow's-foot cardinality reads `||` as _exactly one_ and `o{` as
> _zero-or-many_. "Many" relationships are stored as **id arrays on the
> parent** (a document-style key-value pattern), not as child-row foreign
> keys.

![PlayNexus data model — entities, key fields and foreign-key relationships](data-architecture.png)

## Full data model

```mermaid
erDiagram
    Auth {
        string username "unique key"
        userId userId "references User"
        string password "Supabase-auth backed"
    }
    User {
        userId userId "generated key"
        username username "unique, references Auth"
        string display ""
        Date createdAt ""
        string bio "optional"
        string accentColor "optional"
        string avatarUrl "optional"
        string email "optional, for 2FA"
        boolean mfaEnabled "optional"
        boolean rememberMe "optional"
    }
    User ||--|| Auth: "User.username / Auth.userId"

    Session {
        sessionId sessionId "generated key"
        userId userId "references User"
        string tokenHash "unique, SHA-256 of cookie token"
        Date createdAt ""
        Date expiresAt ""
        boolean remember ""
        boolean revoked ""
        Date lastSeen ""
    }
    User ||--o{ Session: "Session.userId"

    OtpChallenge {
        challengeId challengeId "generated key"
        userId userId "references User"
        string email ""
        string codeHash "SHA-256 of 6-digit code"
        OtpPurpose purpose "login | enroll"
        boolean remember ""
        number attempts "max 5"
        boolean consumed "single-use"
        Date createdAt ""
        Date expiresAt "10-min TTL"
    }
    User ||--o{ OtpChallenge: "OtpChallenge.userId"

    Thread {
        threadId threadId "generated key"
        string title ""
        string text ""
        Date createdAt ""
        userId createdBy ""
        commentId[] comments ""
    }
    Thread ||--|| User: "Thread.createdBy"
    Thread ||--o{ Comment: "Thread.comments"

    Comment {
        commentId commentId "generated key"
        string text ""
        userId createdBy ""
        Date createdAt ""
        Date editedAt "can be null"
    }
    Comment ||--|| User: "Comment.createdBy"

    Game {
        gameId gameId "generated key"
        GameKey type "nim | guess | cribbage"
        unknown state ""
        boolean done ""
        chatId chat ""
        userId[] players "AI sentinel allowed"
        Date createdAt ""
        userId createdBy ""
        boolean singlePlayer "optional, cribbage vs AI"
    }
    Game ||--|| Chat: "Game.chat"
    Game ||--|| User: "Game.createdBy"
    Game ||--o{ User: "Game.players"

    Chat {
        chatId chatId "generated key"
        messageId[] messages ""
        Date createdAt ""
    }
    Chat ||--o{ Message: "Chat.messages"

    Message {
        messageId messageId "generated key"
        string text ""
        userId createdBy ""
        Date createdAt ""
    }
    Message ||--|| User: "Message.createdBy"

    Friendship {
        friendshipId friendshipId "generated key"
        userId fromUserId "references User"
        userId toUserId "references User"
        FriendshipStatus status "pending | accepted | rejected | blocked"
        Date createdAt ""
        Date updatedAt ""
    }
    Friendship ||--|| User: "Friendship.fromUserId"
    Friendship ||--|| User: "Friendship.toUserId"

    DMThread {
        dmThreadId dmThreadId "generated key"
        userId[] participants "exactly 2 users"
        messageId[] messages ""
        Date createdAt ""
    }
    DMThread ||--o{ User: "DMThread.participants"
    DMThread ||--o{ Message: "DMThread.messages"
```

## High-level view (domains)

```mermaid
erDiagram
    User ||--|| Auth         : "authenticates with"
    User ||--o{ Session      : "has login sessions"
    User ||--o{ OtpChallenge : "email 2FA codes"
    User ||--o{ Friendship   : "friend requests"
    User ||--o{ DMThread     : "direct messages"
    DMThread ||--o{ Message  : "contains"
    User ||--o{ Thread       : "posts"
    Thread ||--o{ Comment    : "has"
    User ||--o{ Comment      : "writes"
    User ||--o{ Game         : "plays / creates"
    Game ||--|| Chat         : "has"
    Chat ||--o{ Message      : "contains"
    User ||--o{ Message      : "sends"
```

## Notes for readers

- **Document/denormalized model:** "many" links are id arrays on the parent
  (`Thread.comments`, `Chat.messages`, `Game.players`,
  `DMThread.participants`), reflecting the key-value store rather than
  normalized child-row FKs.
- **Shared `Message`:** the same `Message` entity is referenced by both game
  `Chat` and `DMThread`; it carries `createdBy` but no back-pointer to its
  container.
- **AI players:** a `Game.players` entry may be an AI sentinel id
  (single-player Cribbage), which is intentionally not a real `User` row.
- **Game invitations are not persisted** — they are delivered as real-time
  socket events, so they do not appear in the data model.
