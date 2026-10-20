import type { FormEvent } from "react";

import { channelLabels, type ChannelKind } from "@/lib/inbox";

type ConnectionModalProps = {
  modalKind: ChannelKind;
  busy: boolean;
  error: string;
  telegramPendingId: string;
  telegramNeedsPassword: boolean;
  onClose: () => void;
  onSubmitConnection: (event: FormEvent<HTMLFormElement>) => void;
};

export function ConnectionModal({
  modalKind,
  busy,
  error,
  telegramPendingId,
  telegramNeedsPassword,
  onClose,
  onSubmitConnection,
}: ConnectionModalProps) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section className="connect-modal" role="dialog" aria-modal="true" aria-labelledby="connect-title">
        <button className="modal-close" type="button" aria-label="Close" onClick={onClose} disabled={busy}>
          ×
        </button>
        <p className="eyebrow">ACCOUNT CONNECTION</p>
        <h2 id="connect-title">Connect {channelLabels[modalKind]}</h2>

        {modalKind === "whatsapp-business" && (
          <form className="connect-form" onSubmit={onSubmitConnection}>
            <p>Use a WhatsApp Business Cloud API phone number and a Meta access token.</p>
            <a className="tutorial-link" href="/guide#whatsapp" target="_blank" rel="noreferrer">
              How to connect WhatsApp Business ↗
            </a>
            <label>
              Phone number ID
              <input name="phoneNumberId" required inputMode="numeric" />
            </label>
            <label>
              Permanent access token
              <input name="accessToken" type="password" required autoComplete="off" />
            </label>
            <small>
              The token is encrypted locally. Incoming messages also require the Meta webhook at
              /api/webhooks/whatsapp, WHATSAPP_VERIFY_TOKEN, and WHATSAPP_APP_SECRET in .env.local.
            </small>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-button auth-submit" type="submit" disabled={busy}>
              {busy ? "Verifying…" : "Verify and connect"}
            </button>
          </form>
        )}

        {modalKind === "telegram-bot" && (
          <form className="connect-form" onSubmit={onSubmitConnection}>
            <p>Paste the bot token from BotFather. Messages sent to the bot will be synced.</p>
            <a className="tutorial-link" href="/guide#telegram-bot" target="_blank" rel="noreferrer">
              How to connect a Telegram bot ↗
            </a>
            <label>
              Bot token
              <input name="token" type="password" required autoComplete="off" />
            </label>
            <small>The token is encrypted and stored in the local database.</small>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-button auth-submit" type="submit" disabled={busy}>
              {busy ? "Verifying…" : "Verify and connect"}
            </button>
          </form>
        )}

        {modalKind === "telegram-personal" && (
          <form className="connect-form" onSubmit={onSubmitConnection}>
            {!telegramPendingId ? (
              <>
                <p>Sign in to your personal Telegram account using Telegram’s client API.</p>
                <a className="tutorial-link" href="/guide#telegram-personal" target="_blank" rel="noreferrer">
                  How to connect personal Telegram ↗
                </a>
                <label>
                  Phone number
                  <input name="phoneNumber" type="tel" placeholder="+14155550123" required />
                </label>
                <small>
                  Configure TELEGRAM_API_ID and TELEGRAM_API_HASH in the local environment first.
                </small>
              </>
            ) : (
              <>
                <p>Enter the login code sent by Telegram.</p>
                <label>
                  Login code
                  <input name="code" inputMode="numeric" required={!telegramNeedsPassword} />
                </label>
                {telegramNeedsPassword && (
                  <label>
                    Telegram two-step verification password
                    <input
                      name="password"
                      type="password"
                      autoComplete="off"
                      required
                      placeholder="Your Telegram password"
                    />
                  </label>
                )}
              </>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-button auth-submit" type="submit" disabled={busy}>
              {busy ? "Verifying…" : telegramPendingId ? "Finish connection" : "Send code"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
