import Link from "next/link";

export const metadata = {
  title: "Connection guide — Buroq",
  description: "How to connect WhatsApp Business and Telegram to your local Buroq inbox.",
};

export default function ConnectionGuide() {
  return (
    <main className="guide-shell">
      <article className="guide-card">
        <Link className="guide-back" href="/">
          ← Back to inbox
        </Link>
        <p className="auth-eyebrow">BUROQ CONNECTION GUIDE</p>
        <h1>Connect WhatsApp and Telegram</h1>
        <p className="guide-intro">
          Buroq runs locally and stores provider credentials on this device. Choose the kind of
          account you want to connect, prepare its provider credentials, then verify it in the
          inbox.
        </p>

        <nav className="guide-toc" aria-label="Guide sections">
          <a href="#whatsapp">WhatsApp Business</a>
          <a href="#telegram-bot">Telegram bot</a>
          <a href="#telegram-personal">Personal Telegram</a>
          <a href="#troubleshooting">Troubleshooting</a>
        </nav>

        <section id="whatsapp" className="guide-section">
          <h2>WhatsApp Business Cloud API</h2>
          <p>
            This connects a <strong>WhatsApp Business</strong> phone number through Meta’s Cloud
            API. It does not connect a personal WhatsApp account or import old chat history.
          </p>
          <ol>
            <li>
              In the Meta for Developers dashboard, create or select an app, add the WhatsApp
              product, and finish setting up a WhatsApp Business account and phone number.
            </li>
            <li>
              Get an access token with the WhatsApp Business messaging permissions and copy the
              phone number ID shown for the API phone number. Keep the token private.
            </li>
            <li>
              To receive incoming messages, make the Buroq webhook URL reachable by Meta over HTTPS.
              Set these values in the project’s <code>.env.local</code>:
              <pre>
                <code>{`WHATSAPP_VERIFY_TOKEN=choose-a-private-random-value
WHATSAPP_APP_SECRET=your-meta-app-secret`}</code>
              </pre>
              The verify token is a value you choose; enter the same value when configuring the
              webhook in Meta. The app secret is available in the Meta app settings. Restart Buroq
              after editing the environment file.
            </li>
            <li>
              In the Meta app’s WhatsApp webhook configuration, use{" "}
              <code>https://YOUR-HOST/api/webhooks/whatsapp</code> as the callback URL, enter the
              matching verify token, complete verification, and subscribe to the{" "}
              <code>messages</code> field.
            </li>
            <li>
              Sign in to Buroq, choose <strong>WhatsApp Business</strong> under Connect your
              accounts, enter the phone number ID and access token, then choose{" "}
              <strong>Verify and connect</strong>.
            </li>
          </ol>
          <p className="guide-notice">
            Meta needs a publicly reachable HTTPS webhook; <code>localhost</code> is not reachable
            by Meta. Buroq is designed for trusted local use, not public hosting. If you use a
            temporary HTTPS tunnel for webhook testing, protect it and shut it down when finished.
            Incoming messages arrive only after the webhook is configured. Replies are text-only and
            subject to Meta’s messaging rules and customer-service window.
          </p>
          <p>
            References:{" "}
            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/"
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp Cloud API
            </a>{" "}
            ·{" "}
            <a
              href="https://developers.facebook.com/docs/graph-api/webhooks/getting-started"
              target="_blank"
              rel="noreferrer"
            >
              Meta webhooks
            </a>
          </p>
        </section>

        <section id="telegram-bot" className="guide-section">
          <h2>Telegram bot</h2>
          <p>
            A bot connection shows messages sent to that bot. It does not give Buroq access to your
            personal Telegram chats.
          </p>
          <ol>
            <li>
              Open Telegram and chat with{" "}
              <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">
                @BotFather
              </a>
              . Use <code>/newbot</code>, follow its instructions, and copy the bot token.
            </li>
            <li>
              In Buroq, choose <strong>Telegram bot</strong>, paste the token, and choose{" "}
              <strong>Verify and connect</strong>.
            </li>
            <li>
              Find the new bot in Telegram and press <strong>Start</strong> or send it a message.
              Its incoming text messages appear in Buroq when you refresh the inbox; reply from the
              conversation in Buroq.
            </li>
          </ol>
          <p className="guide-notice">
            This app uses Telegram polling. The bot cannot already be using a webhook with another
            service; remove that webhook before connecting if you want to move the bot here.
            Removing it can interrupt the other service. Bot updates are fetched when the inbox is
            refreshed.
          </p>
          <p>
            Reference:{" "}
            <a href="https://core.telegram.org/bots/tutorial" target="_blank" rel="noreferrer">
              Telegram bot tutorial
            </a>
          </p>
        </section>

        <section id="telegram-personal" className="guide-section">
          <h2>Personal Telegram account</h2>
          <p>
            This option signs in as your personal Telegram user account, separately from the bot
            connection.
          </p>
          <ol>
            <li>
              Sign in at{" "}
              <a href="https://my.telegram.org" target="_blank" rel="noreferrer">
                my.telegram.org
              </a>
              , open <strong>API development tools</strong>, and create an application to get an API
              ID and API hash.
            </li>
            <li>
              Add them to <code>.env.local</code>, then restart Buroq:
              <pre>
                <code>{`TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash`}</code>
              </pre>
            </li>
            <li>
              In Buroq, choose <strong>Telegram personal</strong>, enter your phone number in
              international format (for example <code>+14155550123</code>), and choose{" "}
              <strong>Send login code</strong>.
            </li>
            <li>
              Enter the login code Telegram sends you. If two-step verification is enabled, enter
              your Telegram password when prompted.
            </li>
          </ol>
          <p className="guide-notice">
            The session is stored encrypted on this device. Buroq syncs text messages from up to the
            50 most recent dialogs when you refresh; non-text messages are not shown. To end the
            session, disconnect the account in Buroq or revoke it in Telegram’s active sessions
            settings.
          </p>
          <p>
            Reference:{" "}
            <a
              href="https://core.telegram.org/api/obtaining_api_id"
              target="_blank"
              rel="noreferrer"
            >
              Obtaining Telegram API credentials
            </a>
          </p>
        </section>

        <section id="troubleshooting" className="guide-section">
          <h2>Troubleshooting and credential safety</h2>
          <ul>
            <li>
              If a connection is rejected, check the token, ID, and permissions, then try verifying
              it again.
            </li>
            <li>
              If personal Telegram setup says its API credentials are missing, check the variable
              names in <code>.env.local</code> and restart the app.
            </li>
            <li>
              If Telegram bot setup reports a webhook conflict, another service may own the bot’s
              webhook. Do not remove it unless you intend to move the bot to Buroq.
            </li>
            <li>
              Never paste provider secrets into chat, commit them, or share the local{" "}
              <code>data/</code> directory. Buroq encrypts saved provider credentials and personal
              Telegram sessions locally, but saved message text is not encrypted at the database
              level.
            </li>
          </ul>
        </section>
      </article>
    </main>
  );
}
