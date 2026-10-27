# Complete Webhook Guide with ngrok: Telegram Bot & WhatsApp Business

This guide explains how to expose a local web application using ngrok so that external messaging providers—specifically **WhatsApp Business Cloud API** and **Telegram Bot API**—can push incoming messages directly to your local inbox in real time.

---

## 1. Why Do Local Apps Need ngrok for Webhooks?

When someone sends a message to your WhatsApp Business number or your Telegram Bot:

1. The provider's servers (Meta or Telegram) must deliver that message to your application.
2. They deliver messages by sending an **HTTP POST request** (a _webhook_) to a public HTTPS URL that you provide.
3. Your computer runs locally on `localhost` (e.g. `http://localhost:8000`). Meta and Telegram **cannot reach `localhost`** from the internet.
4. **ngrok** provides a secure, public HTTPS tunnel (e.g. `https://xxxx.ngrok-free.app`) that routes incoming webhooks from the internet directly to your local port.

### Provider Comparison

| Provider              | Inbound Messages                           | Needs ngrok?            | What happens when ngrok is OFF?                                                            |
| :-------------------- | :----------------------------------------- | :---------------------- | :----------------------------------------------------------------------------------------- |
| **WhatsApp Business** | Webhook only (Meta pushes to you)          | **YES (Required)**      | **Completely blocked** — Meta has no polling fallback, so incoming messages cannot arrive. |
| **Telegram Bot**      | Webhook (Instant) or Polling (5s interval) | **YES (for Real-Time)** | **Delayed** — Falls back to periodic polling (`getUpdates`) when the inbox refreshes.      |
| **Telegram Personal** | Direct MTProto client connection           | **NO**                  | Connects directly from your machine to Telegram servers via client session.                |

---

## 2. Option A: Using the In-App Buroq ngrok Manager (Recommended)

Buroq includes a built-in ngrok manager directly on the dashboard.

### Step 1: Activate the tunnel

1. Open Buroq in your browser at [http://localhost:8000](http://localhost:8000).
2. On the Inbox Dashboard, locate the **Real-Time Webhook (ngrok)** card (or the **⚡ ngrok** button in the top bar).
3. Click **⚡ Activate ngrok**.
4. Buroq automatically launches the tunnel, detects the public HTTPS URL, and displays `TUNNEL ACTIVE`.

### Step 2: Telegram Bot (100% Automated)

- When ngrok starts, Buroq **automatically registers all connected Telegram bots** with Telegram's Bot API (`setWebhook`).
- Any pending or new messages sent to your bot arrive in Buroq instantly via Socket.IO.
- When you click **Stop ngrok**, Buroq cleanly calls `deleteWebhook` so Telegram stops sending requests to an inactive tunnel.

### Step 3: WhatsApp Business Setup

Because WhatsApp webhooks must be authorized inside Meta's Developer Dashboard:

1. In Buroq, click **Webhook URLs & Setup** on the ngrok card.
2. Under the **WhatsApp Business** tab, copy the **Webhook Callback URL** and **Verify Token**:
   - **Callback URL:** `https://<your-ngrok-url>.ngrok-free.app/api/webhooks/whatsapp`
   - **Verify Token:** Your generated or configured verify token string.
3. Click **🧪 Test Webhook Verification** inside Buroq to ensure your local endpoint is ready to respond with `200 OK`.
4. Open the [Meta for Developers App Dashboard](https://developers.facebook.com/apps/).
5. Go to **WhatsApp** → **Configuration** in the left sidebar.
6. Under **Webhook**, click **Edit**.
7. Paste the **Callback URL** and **Verify Token**, then click **Verify and save**.
8. Under **Webhook fields**, click **Manage** and subscribe to **`messages`**.

---

## 3. Option B: Manual CLI Setup

If you prefer to run ngrok manually in your terminal, follow these steps:

### 1. Start your local application

```bash
cd ~/buroq
PORT=8000 npm run dev
```

### 2. Verify ngrok installation

Check whether ngrok is installed:

```bash
ngrok version
```

If not installed on macOS:

```bash
brew install ngrok
```

### 3. Configure your ngrok authtoken

Sign in to [dashboard.ngrok.com](https://dashboard.ngrok.com/), copy your authtoken, and configure it:

```bash
ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN
```

### 4. Open the tunnel to your application port

In a separate terminal window:

```bash
ngrok http 8000
```

ngrok will show a public forwarding address:

```text
Forwarding   https://xxxx.ngrok-free.app -> http://localhost:8000
```

Copy the `https://...` address. Keep this terminal running.

### 5. Configure environment variables in `.env.local`

Open `.env.local`:

```bash
nano .env.local
```

Add or update the webhook variables:

```dotenv
# Telegram Bot Webhook
TELEGRAM_WEBHOOK_BASE_URL=https://xxxx.ngrok-free.app
TELEGRAM_WEBHOOK_SECRET=MySuperSecureSecretToken123_abc

# WhatsApp Business Webhook
WHATSAPP_VERIFY_TOKEN=choose-a-private-random-token
WHATSAPP_APP_SECRET=your-meta-app-secret-from-dashboard
```

---

## 4. WhatsApp Business Cloud API Webhook Details

### Verification Request (Handshake)

When you save the webhook in Meta's Dashboard, Meta makes a `GET` request:

```text
GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=1158201444&hub.verify_token=YOUR_VERIFY_TOKEN
```

Buroq verifies that `hub.verify_token` matches your configured token, then returns the raw `hub.challenge` string with HTTP `200 OK`.

### Incoming Message Notification

When a customer sends a message on WhatsApp, Meta sends a `POST` request with a JSON payload:

- Header `x-hub-signature-256`: SHA-256 HMAC of the request body signed with your `WHATSAPP_APP_SECRET`.
- Buroq verifies the HMAC signature using timing-safe comparison.
- The message body and sender are extracted, saved into SQLite, and pushed over Socket.IO to the browser.

---

## 5. Telegram Bot Webhook Details

### Registration URL

Telegram bot webhooks use connection-specific endpoints:

```text
https://<your-ngrok-url>.ngrok-free.app/api/webhooks/telegram/<connectionId>
```

### Manual Registration via Bot API

You can register or update the webhook directly using `curl`:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://xxxx.ngrok-free.app/api/webhooks/telegram/<CONNECTION_ID>",
    "secret_token": "YOUR_TELEGRAM_WEBHOOK_SECRET",
    "allowed_updates": ["message"]
  }'
```

### Inspecting Webhook Status

To check if Telegram successfully delivers webhooks:

```bash
curl -s "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo" | jq
```

Key fields to check:

- `url`: The registered public URL.
- `pending_update_count`: Number of messages queued by Telegram. If greater than 0 and not decreasing, your server is returning an error or is unreachable.
- `last_error_message`: Most recent error encountered by Telegram when calling your webhook.

To query existing connection IDs in Buroq:

```bash
sqlite3 data/buroq.sqlite \
  "SELECT id, label, status FROM connections WHERE kind = 'telegram-bot';"
```

---

## 6. Troubleshooting

### HTTP 401 Unauthorized

- **Telegram:** The incoming `x-telegram-bot-api-secret-token` header does not match `TELEGRAM_WEBHOOK_SECRET`.
- **WhatsApp:** The `x-hub-signature-256` header does not match the signature calculated using `WHATSAPP_APP_SECRET`.

### HTTP 403 Forbidden on WhatsApp GET

- The `hub.verify_token` sent by Meta does not match the `WHATSAPP_VERIFY_TOKEN` configured in Buroq.
- Check your verify token in the in-app **ngrok Setup Modal** under **Settings & Secrets**.

### The ngrok URL changed after restart

Free ngrok sessions generate a new URL upon each restart.

- If using the **Buroq UI**, simply activate ngrok; connected Telegram bots are updated automatically. For WhatsApp, update the Callback URL in Meta's Developer Dashboard.
- If you have a paid ngrok account or a free static domain, you can enter your static domain in the in-app ngrok settings (e.g. `--domain=my-subdomain.ngrok-free.app`).

### Webhook Traffic Inspector

When ngrok is active, you can inspect raw HTTP headers and request bodies sent by Meta or Telegram at:
[http://127.0.0.1:4040](http://127.0.0.1:4040)

---

## 7. Security Checklist

- **Never commit secrets:** Keep bot tokens, access tokens, and webhook secrets out of git.
- **Always use HTTPS:** Meta and Telegram strictly reject plain `http://` webhook URLs.
- **Timing-safe comparison:** Buroq uses `timingSafeEqual` for all webhook authentication tokens to prevent timing attacks.
- **Shutdown when done:** When you are done testing, turn off the tunnel via **Stop ngrok** in the UI or press `Ctrl+C` in your terminal.

---

## Official Documentation Links

- [ngrok Documentation](https://ngrok.com/docs/)
- [Meta WhatsApp Webhooks Getting Started](https://developers.facebook.com/docs/graph-api/webhooks/getting-started)
- [WhatsApp Cloud API Messages Webhook](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components)
- [Telegram Bot API `setWebhook`](https://core.telegram.org/bots/api#setwebhook)
- [Telegram Bot API `getWebhookInfo`](https://core.telegram.org/bots/api#getwebhookinfo)
