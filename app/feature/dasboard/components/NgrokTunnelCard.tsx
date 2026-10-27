import { useState } from "react";
import type { NgrokStatus } from "@/lib/inbox";

type NgrokTunnelCardProps = {
  status: NgrokStatus | null;
  loading: boolean;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  onOpenModal: () => void;
};

export function NgrokTunnelCard({
  status,
  loading,
  onStart,
  onStop,
  onOpenModal,
}: NgrokTunnelCardProps) {
  const [copied, setCopied] = useState(false);
  const isActive = status?.active && Boolean(status?.publicUrl);
  const isStarting = loading || status?.status === "starting";

  async function handleCopyUrl() {
    if (!status?.publicUrl) return;
    try {
      await navigator.clipboard.writeText(status.publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <section className={`ngrok-card ${isActive ? "active" : ""}`} aria-label="ngrok Webhook Tunnel">
      <div className="ngrok-card-main">
        <div className="ngrok-card-info">
          <div className="ngrok-header-row">
            <span
              className={`ngrok-status-dot ${isActive ? "active" : isStarting ? "starting" : "inactive"}`}
            />
            <h3 className="ngrok-title">Real-Time Webhook (ngrok)</h3>
            <span
              className={`ngrok-badge ${isActive ? "active" : isStarting ? "starting" : "inactive"}`}
            >
              {isActive ? "TUNNEL ACTIVE" : isStarting ? "STARTING…" : "OFFLINE"}
            </span>
          </div>

          {isActive ? (
            <div className="ngrok-url-bar">
              <span className="ngrok-url-label">Public URL:</span>
              <code className="ngrok-public-url">{status.publicUrl}</code>
              <button
                type="button"
                className="ngrok-mini-copy-btn"
                onClick={handleCopyUrl}
                title="Copy ngrok Public URL"
              >
                {copied ? "✓ Copied" : "Copy"}
              </button>
              <a
                href={status.publicUrl || undefined}
                target="_blank"
                rel="noreferrer"
                className="ngrok-ext-link"
                title="Open in new tab"
              >
                ↗
              </a>
            </div>
          ) : (
            <p className="ngrok-desc">
              Activate ngrok to expose your local inbox port ({status?.port || 8000}) to WhatsApp
              and Telegram webhooks for instant, real-time message delivery.
            </p>
          )}

          {isActive && (
            <p className="ngrok-active-note">
              Forwarding to localhost:{status?.port || 8000} · WhatsApp and Telegram bots receive
              messages live via webhook without polling delay.
            </p>
          )}

          {status?.error && (
            <p className="ngrok-card-error" role="alert">
              ⚠️ {status.error}
            </p>
          )}
        </div>

        <div className="ngrok-actions">
          {isActive ? (
            <>
              <button type="button" className="secondary-button ngrok-btn" onClick={onOpenModal}>
                Webhook URLs & Setup
              </button>
              <button
                type="button"
                className="danger-button ngrok-stop-btn"
                onClick={() => void onStop()}
                disabled={loading}
              >
                {loading ? "Stopping…" : "Stop ngrok"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="primary-button ngrok-activate-btn"
                onClick={() => void onStart()}
                disabled={isStarting}
              >
                {isStarting ? "Activating ngrok…" : "⚡ Activate ngrok"}
              </button>
              <button type="button" className="secondary-button ngrok-btn" onClick={onOpenModal}>
                Configure
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
