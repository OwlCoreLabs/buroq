import type { SubmitEvent } from "react";

type DeleteAccountModalProps = {
  busy: boolean;
  deletePassword: string;
  deleteError: string;
  onClose: () => void;
  onDeletePasswordChange: (value: string) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
};

export function DeleteAccountModal({
  busy,
  deletePassword,
  deleteError,
  onClose,
  onDeletePasswordChange,
  onSubmit,
}: DeleteAccountModalProps) {
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
        aria-labelledby="delete-account-title"
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
        <p className="eyebrow">PERMANENT ACTION</p>
        <h2 id="delete-account-title">Delete local account?</h2>
        <form className="connect-form" onSubmit={onSubmit}>
          <p>
            This permanently deletes the account, all saved messages, channel connections, and
            credentials from this device. It cannot be undone. Revoke WhatsApp or Telegram bot
            credentials with their providers separately, and revoke the personal Telegram session in
            Telegram settings.
          </p>
          <label>
            Enter your current password to confirm
            <input
              type="password"
              autoComplete="current-password"
              required
              value={deletePassword}
              onChange={(event) => onDeletePasswordChange(event.target.value)}
            />
          </label>
          {deleteError && (
            <p className="form-error" role="alert">
              {deleteError}
            </p>
          )}
          <button className="danger-button" type="submit" disabled={busy}>
            {busy ? "Deleting…" : "Permanently delete account"}
          </button>
        </form>
      </section>
    </div>
  );
}
