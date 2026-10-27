import type { SubmitEvent } from "react";

import type { ChannelConnection } from "@/lib/inbox";

type TelegramMessageModalProps = {
  connection: ChannelConnection;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
};

export function TelegramMessageModal({
  connection,
  busy,
  error,
  onClose,
  onSubmit,
}: TelegramMessageModalProps) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="connect-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="telegram-message-title"
      >
        <button
          className="modal-close"
          type="button"
          aria-label="Close"
          onClick={onClose}
          disabled={busy}
        >
          ×
        </button>
        <p className="eyebrow">NEW TELEGRAM MESSAGE</p>
        <h2 id="telegram-message-title">Message {connection.label}</h2>
        <form className="connect-form" onSubmit={onSubmit}>
          <p>
            The recipient must open your bot and press <strong>Start</strong> before the bot can
            send them a message.
          </p>
          <label>
            Telegram chat ID
            <input name="providerChatId" required inputMode="numeric" placeholder="123456789" />
          </label>
          <small>
            Find this ID from an existing conversation, or use Telegram&apos;s @userinfobot after
            the recipient starts your bot.
          </small>
          <label>
            Recipient name
            <input name="recipientTitle" placeholder="Optional" />
          </label>
          <label>
            Message
            <textarea name="body" required maxLength={4096} rows={5} autoFocus />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button auth-submit" type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send message"}
          </button>
        </form>
      </section>
    </div>
  );
}
