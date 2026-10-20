# Buroq Architecture

## 1. High-level structure

Buroq is a local-first Next.js inbox app. The server owns authentication and persistence, while the client UI keeps ephemeral interface state in Zustand stores.

Core folders:

- `app/` — Next.js routes and client UI screens
- `lib/server/` — server-side auth, database, and message logic
- `lib/store/` — client-side Zustand stores
- `data/` — local SQLite database files

## 2. Server-first auth and persistence

Authentication is not stored in the browser. It is handled in `lib/server/auth.ts` with:

- cookie-based session tokens
- SQLite-backed user records
- password hashing via scrypt
- recovery code verification and password resets

This keeps credentials local to the device, which matches the product expectation for a local inbox.

The app entry `app/page.tsx` checks the current user on the server and then renders either:

- `AuthScreen` when no valid session exists
- `InboxDashboard` when a valid session exists

This is the main server/client boundary in the app.

## 3. Zustand as UI state orchestration

The UI uses Zustand for state that is local to the client and does not need to be transmitted back to the server immediately.

### Auth store

`lib/store/useAuthStore.ts` owns the client-side auth form state:

- mode (`setup`, `login`, `recover`, `recovery-code`)
- username and password
- recovery code and pending login state
- busy/error/notice flags

This keeps form logic contained to one small state slice and prevents prop drilling across the auth screen.

### Inbox store

`lib/store/useInboxStore.ts` owns the client-side inbox state:

- loaded connections and conversations
- selected conversation id and current filter/search
- reply draft and loading/busy/error state
- modal state for connecting channels
- Telegram verification state and account deletion flow

This keeps all related UI decisions in one place and makes the dashboard easier to evolve without spreading state across many component-level hooks.

## 4. Component responsibilities

### `AuthScreen`

The auth screen is a thin presentational client shell. It reads the store values and dispatches requests to the backend APIs:

- `/api/auth/setup`
- `/api/auth/login`
- `/api/auth/recover`

It does not own the form state directly; it delegates to the store.

### `InboxDashboard`

The inbox dashboard reads from the inbox store and calls backend endpoints when the user:

- refreshes data
- selects a conversation
- sends a reply
- connects/disconnects accounts
- signs out or deletes the local account

The dashboard remains readable because state transitions are centralized and actions are named explicitly. Feature behavior is further separated into `lib/hooks/useInboxDashboard.ts`, which orchestrates the async flows and keeps the screen focused on composition and rendering.

## 5. Data flow

A typical inbox interaction looks like this:

1. `useInboxStore.refresh()` fetches `/api/inbox`
2. The API returns connection and conversation data
3. The store updates `connections`, `conversations`, and `selectedId`
4. The dashboard re-renders from store state
5. When a conversation is selected, the UI optionally marks it as read by calling the inbox endpoint and then refreshes

This keeps the fetch logic and the UI state close together while still separating transport concerns.

## 6. Why this architecture works

- Clear server/client separation: server logic handles user identity and persistence; client UI handles interactions.
- Minimal prop drilling: Zustand provides a shared state container without unnecessary component nesting.
- Easier maintenance: each feature has a single source of truth for its UI state.
- Safer local-first approach: sensitive data stays in local SQLite and browser cookies, not in a remote database.

## 7. Suggested future improvements

- Add persistence middleware for selected filters or draft replies
- Split the inbox store further into smaller slices (`connections`, `messages`, `modals`)
- Add typed selectors to reduce re-renders and keep store access explicit
- Consider extracting API helpers to keep fetch logic separate from UI state updates

That keeps the architecture simple while leaving room for the app to grow.
