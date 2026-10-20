# Buroq

Buroq is a single-user, local inbox for WhatsApp Business and Telegram. The
first run creates a local username and password. Channel credentials and
Telegram sessions are encrypted before storage in a local SQLite database.
Message contents are stored locally in SQLite without database-level
encryption; there are no sample messages and no hosted auth or database.

## Run locally

Use Node.js 20.19+, 22.13+, or 24+ and Yarn Classic:

```bash
yarn install
cp .env.example .env.local
yarn dev
```

Open [http://localhost:3000](http://localhost:3000). On first run, create a
username and a password of at least 1 character. Save the one-time recovery
code shown during setup, then sign in.

The database and encryption key are created in `./data`. Keep this directory
private and include both the database and key in any secure backup. Losing the
key makes saved channel credentials and Telegram sessions unreadable.

## Connect accounts

For a step-by-step walkthrough, open the in-app [Connection guide](/guide) after
signing in.

### WhatsApp Business

In Meta's WhatsApp Business Platform / Cloud API setup, create a permanent
access token with the WhatsApp messaging permissions and copy the phone number
ID. In Buroq, choose **WhatsApp Business**, enter those values, and verify the
connection. The token is encrypted before it is stored.

To receive incoming messages, configure a Meta webhook pointing at
`https://<your-public-host>/api/webhooks/whatsapp`, subscribe to the `messages`
field, and set the same verify token in Meta and `WHATSAPP_VERIFY_TOKEN`.
`WHATSAPP_APP_SECRET` is required so the app can verify Meta's webhook
signatures. Restart Buroq after changing `.env.local`.

The Cloud API does not provide a user's personal WhatsApp chat history. This
integration receives messages delivered to the connected business number after
the webhook is configured; it does not import older messages.

### Telegram bot

Create a bot using Telegram's BotFather, then enter its token in Buroq under
**Telegram bot**. Buroq verifies the token and reads updates using Telegram's
Bot API. The bot must not already have a webhook configured because this local
setup uses polling. A bot only receives conversations sent to that bot; it
cannot read the bot owner's personal Telegram history.

### Personal Telegram account

Create Telegram API credentials at [my.telegram.org](https://my.telegram.org),
then set `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` in `.env.local`. Restart
Buroq, choose **Telegram personal**, and complete the phone-code and optional
two-step-verification prompts. The MTProto session is encrypted in the local
database. Personal Telegram history is private to this local installation.

## Current message behavior

- WhatsApp Business incoming text messages arrive through the Meta webhook;
  replies are sent through the WhatsApp Cloud API.
- Telegram bot messages are fetched from Bot API updates when the inbox is
  refreshed; replies are sent through the bot.
- Personal Telegram syncs text history from its 50 most recent dialogs when
  the inbox is refreshed; replies are sent from the connected Telegram user
  account. Non-text messages are not shown.
- Disconnecting an account deletes its locally stored conversation history.
- The app keeps no fake or seeded conversation data.

The app is designed for one trusted local operator. Do not expose it publicly:
the local password is not a multi-user identity system, and the SQLite database
contains private message history. A public deployment needs proper user
authentication, authorization, backups, and a protected database.

## Local account recovery and deletion

Use **Forgot password?** on the sign-in screen with the username and saved
recovery code to choose a new password. The code is stored as a hash and cannot
be displayed again. If an older local account has no recovery code yet, the
code is shown once after its next successful sign-in.

**Delete local account** requires the current password. A wrong password leaves
the account untouched. Confirmed deletion removes the local account, saved
messages, channel connections, credentials, and sessions. Revoke WhatsApp or
Telegram bot credentials with the providers separately, and revoke the personal
Telegram session in Telegram settings.

## Project map

```text
app/
  api/auth/                 Local setup, login, recovery, deletion, and logout
  api/connections/          WhatsApp and Telegram connection flows
  api/inbox/                Inbox read/sync and unread state
  api/messages/             Provider-backed message sending
  api/webhooks/whatsapp/    Verified WhatsApp Business webhook
  auth-screen.tsx           Local account setup and sign-in
  inbox-dashboard.tsx       Unified inbox and separate channel connections
  guide/page.tsx            In-app WhatsApp and Telegram setup tutorial
  globals.css               Responsive app styles
  layout.tsx                Root HTML layout and metadata
  page.tsx                  Local auth gate and inbox route
lib/
  inbox.ts                  Shared normalized channel and message types
  server/
    auth.ts                 Local password hashing and session cookies
    connections.ts          Encrypted channel credentials and provider clients
    database.ts             SQLite schema and at-rest credential encryption
    messages.ts             Normalized local conversation/message storage
data/                       Local SQLite database and encryption key (gitignored)
.env.example                Server-side Telegram and webhook configuration
```

## Quality checks

```bash
yarn format:check
yarn lint
yarn typecheck
yarn build
```

Format files with `yarn format`; apply automatic ESLint fixes with
`yarn lint:fix`.
