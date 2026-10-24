# Buroq Architecture

## What Buroq is

Buroq is a local-first inbox for one trusted operator. It combines messages from:

- WhatsApp Business
- Telegram bot
- Personal Telegram account

Data stays in local SQLite. Channel credentials and Telegram sessions are encrypted before storage.

## Main flow

```text
Browser
  │
  ├─ Next.js page: app/page.tsx
  │    ├─ no session → AuthScreen
  │    └─ valid session → InboxDashboard
  │
  └─ API requests
       │
       ├─ auth routes
       ├─ connection routes
       ├─ inbox route
       ├─ message route
       └─ WhatsApp webhook
            │
            └─ lib/server/
                 ├─ auth.ts          session and password logic
                 ├─ connections.ts  provider API calls
                 ├─ messages.ts      conversation and message logic
                 └─ database.ts      SQLite and encryption
```

## Folder map

```text
app/
  page.tsx                         Auth gate and main route
  feature/auth/                    Setup, login, and recovery UI
  feature/dasboard/                Inbox UI and dashboard components
  api/auth/                        Local account and session endpoints
  api/connections/                 Connect and disconnect channels
  api/inbox/                       Sync and read conversations
  api/messages/                    Send replies
  api/webhooks/whatsapp/           Receive verified WhatsApp messages
  guide/                           Connection setup guide

lib/
  inbox.ts                         Shared inbox types and channel labels
  hooks/useInboxDashboard.ts       Dashboard actions and async flows
  store/useAuthStore.ts             Auth form state
  store/useInboxStore.ts            Inbox UI state and refresh logic
  server/auth.ts                    Passwords, sessions, recovery, deletion
  server/connections.ts             Provider clients and credential handling
  server/messages.ts                 Conversation and message queries
  server/database.ts                 SQLite schema and encryption helpers
  socket.ts                          Server-side inbox update event

server.js                           Next.js server plus Socket.IO
 data/                               Local SQLite database and encryption key
```

## Runtime layers

### 1. Next.js server

`server.js` starts Next.js on port `3000` and attaches Socket.IO at `/socket.io`.

`app/page.tsx` runs on the server. It checks the session before choosing the auth screen or inbox dashboard.

### 2. API routes

Every protected route calls `requireLocalUser()` first.

- `/api/auth/*` creates the local account, logs in, resets password, logs out, or deletes the account.
- `/api/connections` adds or lists channel connections.
- `/api/connections/[id]` removes a connection and its local messages.
- `/api/inbox` syncs providers, returns conversations, and marks conversations read.
- `/api/messages` sends a reply through the matching provider.
- `/api/webhooks/whatsapp` verifies and stores incoming WhatsApp messages.

### 3. Server services

`lib/server/` contains all database and provider work. These modules are server-only and must not be imported into client components.

- `auth.ts` hashes passwords with `scrypt`, stores only session token hashes, and uses an HTTP-only cookie.
- `database.ts` opens SQLite, creates tables, and encrypts credentials with AES-256-GCM.
- `connections.ts` talks to Meta, Telegram Bot API, and Telegram MTProto. It stores normalized connection records.
- `messages.ts` stores normalized conversations and messages. Inserts are transactional and duplicate provider messages are ignored.

### 4. Client state

Zustand stores hold temporary browser state:

- `useAuthStore` holds auth form fields, mode, notices, and errors.
- `useInboxStore` holds connections, conversations, selected conversation, filters, drafts, and modal state.
- `useInboxDashboard` calls APIs, refreshes data, sends replies, and handles connection flows.

Client state is not the source of truth. SQLite is.

## Message flow

### Incoming WhatsApp message

```text
Meta webhook
  → signature check
  → find matching WhatsApp connection
  → saveMessage()
  → SQLite conversations/messages
  → Socket.IO inbox:updated event
  → browser refreshes /api/inbox
```

### Incoming Telegram message

Telegram messages are fetched when `/api/inbox` refreshes:

- Telegram bot uses `getUpdates` and advances its saved offset.
- Personal Telegram reads recent dialogs through MTProto.

Both paths call `saveMessage()`.

### Outgoing reply

```text
InboxDashboard
  → POST /api/messages
  → find conversation and connection
  → provider send API
  → save outbound message
  → return saved message
```

## SQLite data model

```text
users                         One local account
sessions                      Hashed login sessions
connections                   Connected provider credentials
conversations                 One row per provider chat
messages                      Messages inside conversations
```

Relationships:

```text
connections 1 ──── * conversations 1 ──── * messages
```

Deleting a connection cascades to its conversations and messages. Deleting the local account removes all connections, sessions, and related message data.

## Security boundaries

- Passwords use `scrypt`; recovery codes are stored as hashes.
- Session tokens are stored as SHA-256 hashes in SQLite.
- Session cookie is HTTP-only, SameSite `lax`, and Secure in production.
- Provider credentials and Telegram sessions use AES-256-GCM.
- SQLite and the encryption key live in `data/`, with restrictive file permissions.
- WhatsApp webhooks require the configured verify token and HMAC signature.
- The app is for one trusted local operator. Do not expose it publicly without stronger authentication, authorization, backups, and database protection.

## Change guide

Use this path when adding a feature:

1. Add or update shared types in `lib/inbox.ts` if data crosses server/client boundary.
2. Put provider or database logic in `lib/server/`.
3. Add an API route under `app/api/` for browser access.
4. Add client state to the relevant Zustand store only when state is shared across dashboard components.
5. Keep screen components focused on rendering; put async dashboard actions in `useInboxDashboard.ts`.
6. Run checks:

```bash
yarn format:check
yarn lint
yarn typecheck
yarn build
```

Avoid adding a new abstraction when an existing API route, service function, or store can own the behavior.
