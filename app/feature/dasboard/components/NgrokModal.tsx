import { useState, type FormEvent } from "react";
import type { NgrokStatus } from "@/lib/inbox";

type NgrokModalProps = {
  status: NgrokStatus | null;
  loading: boolean;
  onClose: () => void;
  onStart: (port?: number, domain?: string) => Promise<NgrokStatus | null>;
  onStop: () => Promise<NgrokStatus | null>;
  onSyncBots: () => Promise<NgrokStatus | null>;
  onSaveSettings: (updates: {
    whatsappVerifyToken?: string;
    whatsappAppSecret?: string;
    telegramSecret?: string;
  }) => Promise<NgrokStatus | null>;
  onTestWhatsApp: () => Promise<{ ok: boolean; message: string }>;
};

export function NgrokModal({
  status,
  loading,
  onClose,
  onStart,
  onStop,
  onSyncBots,
  onSaveSettings,
  onTestWhatsApp,
}: NgrokModalProps) {
  const [activeTab, setActiveTab] = useState<"whatsapp" | "telegram" | "settings">("whatsapp");
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Settings form state
  const [targetPort, setTargetPort] = useState<string>(String(status?.port || 8000));
  const [customDomain, setCustomDomain] = useState<string>("");
  const [waVerifyToken, setWaVerifyToken] = useState<string>(status?.whatsapp.verifyToken || "");
  const [waAppSecret, setWaAppSecret] = useState<string>("");
  const [tgSecret, setTgSecret] = useState<string>(status?.telegram.secret || "");

  const isActive = status?.active && Boolean(status?.publicUrl);
  const isStarting = loading || status?.status === "starting";

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(label);
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      // ignore
    }
  }

  async function handleTestWhatsApp() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await onTestWhatsApp();
      setTestResult(res);
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : "Test failed",
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSaveSettingsSubmit(e: FormEvent) {
    e.preventDefault();
    setSaveSuccess(false);
    await onSaveSettings({
      whatsappVerifyToken: waVerifyToken,
      whatsappAppSecret: waAppSecret ? waAppSecret : undefined,
      telegramSecret: tgSecret ? tgSecret : undefined,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  }

  async function handleStartWithCustomPort(e: FormEvent) {
    e.preventDefault();
    const portNum = Number(targetPort) || 8000;
    await onStart(portNum, customDomain.trim() || undefined);
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <section
        className="connect-modal ngrok-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ngrok-modal-title"
      >
        <button
          className="modal-close"
          type="button"
          aria-label="Close"
          onClick={onClose}
          disabled={loading}
        >
          ×
        </button>

        <p className="eyebrow">REAL-TIME WEBHOOK</p>
        <h2 id="ngrok-modal-title">ngrok Tunnel & Webhook Setup</h2>

        {/* Status banner */}
        <div className={`ngrok-modal-status-box ${isActive ? "active" : "inactive"}`}>
          <div className="ngrok-modal-status-left">
            <span
              className={`ngrok-status-dot ${isActive ? "active" : isStarting ? "starting" : "inactive"}`}
            />
            <div>
              <strong>
                {isActive ? "Tunnel Active" : isStarting ? "Starting tunnel…" : "Tunnel Inactive"}
              </strong>
              {isActive && status?.publicUrl ? (
                <div className="ngrok-modal-url-row">
                  <code>{status.publicUrl}</code>
                  <button
                    type="button"
                    className="ngrok-copy-pill"
                    onClick={() => copyText(status.publicUrl || "", "publicUrl")}
                  >
                    {copyFeedback === "publicUrl" ? "✓ Copied" : "Copy URL"}
                  </button>
                  <a
                    href={status.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ngrok-ext-link"
                    title="Open public tunnel"
                  >
                    ↗
                  </a>
                </div>
              ) : (
                <p className="ngrok-status-hint">
                  {status?.error ||
                    "Start ngrok to receive webhooks for instant incoming messages."}
                </p>
              )}
            </div>
          </div>

          <div className="ngrok-modal-status-right">
            {isActive ? (
              <button
                type="button"
                className="danger-button"
                onClick={() => void onStop()}
                disabled={loading}
              >
                {loading ? "Stopping…" : "Stop Tunnel"}
              </button>
            ) : (
              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  void onStart(Number(targetPort) || 8000, customDomain.trim() || undefined)
                }
                disabled={isStarting}
              >
                {isStarting ? "Starting…" : "⚡ Start ngrok"}
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="ngrok-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "whatsapp"}
            className={`ngrok-tab-btn ${activeTab === "whatsapp" ? "active" : ""}`}
            onClick={() => setActiveTab("whatsapp")}
          >
            WhatsApp Business
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "telegram"}
            className={`ngrok-tab-btn ${activeTab === "telegram" ? "active" : ""}`}
            onClick={() => setActiveTab("telegram")}
          >
            Telegram Bot {status?.telegram.botsCount ? `(${status.telegram.botsCount})` : ""}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "settings"}
            className={`ngrok-tab-btn ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            Tunnel Settings & Secrets
          </button>
        </div>

        {/* Tab 1: WhatsApp Business */}
        {activeTab === "whatsapp" && (
          <div className="ngrok-tab-panel">
            <p className="ngrok-panel-lead">
              Configure Meta’s WhatsApp Cloud API webhook so incoming customer messages reach your
              local Buroq inbox in real time.
            </p>

            <div className="ngrok-config-group">
              <label className="ngrok-field-label">
                Webhook Callback URL:
                <div className="ngrok-field-copy-row">
                  <input
                    readOnly
                    value={
                      status?.whatsapp.url ||
                      (isActive
                        ? `${status?.publicUrl}/api/webhooks/whatsapp`
                        : "Activate ngrok to get URL")
                    }
                    className="ngrok-code-input"
                  />
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!isActive}
                    onClick={() => copyText(status?.whatsapp.url || "", "waUrl")}
                  >
                    {copyFeedback === "waUrl" ? "✓ Copied" : "Copy"}
                  </button>
                </div>
              </label>

              <label className="ngrok-field-label">
                Verify Token:
                <div className="ngrok-field-copy-row">
                  <input
                    readOnly
                    value={status?.whatsapp.verifyToken || ""}
                    className="ngrok-code-input"
                  />
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => copyText(status?.whatsapp.verifyToken || "", "waToken")}
                  >
                    {copyFeedback === "waToken" ? "✓ Copied" : "Copy"}
                  </button>
                </div>
              </label>
            </div>

            <div className="ngrok-test-row">
              <button
                type="button"
                className="secondary-button"
                onClick={handleTestWhatsApp}
                disabled={testing}
              >
                {testing ? "Testing webhook…" : "🧪 Test Webhook Verification"}
              </button>
              {testResult && (
                <span className={`ngrok-test-badge ${testResult.ok ? "success" : "error"}`}>
                  {testResult.ok ? "✓ " : "✗ "}
                  {testResult.message}
                </span>
              )}
            </div>

            <div className="ngrok-instructions">
              <h4>Meta App Dashboard Steps:</h4>
              <ol>
                <li>
                  Go to{" "}
                  <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer">
                    Meta for Developers App Dashboard ↗
                  </a>
                </li>
                <li>
                  Navigate to <strong>WhatsApp</strong> → <strong>Configuration</strong> in the left
                  sidebar.
                </li>
                <li>
                  Click <strong>Edit</strong> in the <strong>Webhook</strong> section.
                </li>
                <li>
                  Paste the <strong>Callback URL</strong> and <strong>Verify Token</strong> from
                  above.
                </li>
                <li>
                  Click <strong>Verify and save</strong>.
                </li>
                <li>
                  Under <strong>Webhook fields</strong>, click <strong>Manage</strong> and subscribe
                  to <code>messages</code>.
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* Tab 2: Telegram Bot */}
        {activeTab === "telegram" && (
          <div className="ngrok-tab-panel">
            <p className="ngrok-panel-lead">
              Buroq automatically manages Telegram bot webhooks. When ngrok activates, connected
              bots are automatically registered with Telegram so messages arrive instantly.
            </p>

            <div className="ngrok-bots-section">
              <div className="ngrok-bots-header">
                <strong>Connected Telegram Bots ({status?.telegram.botsCount || 0})</strong>
                <button
                  type="button"
                  className="secondary-button ngrok-btn-sm"
                  onClick={() => void onSyncBots()}
                  disabled={!isActive || loading}
                >
                  {loading ? "Syncing…" : "↻ Re-sync Webhooks"}
                </button>
              </div>

              {!status?.telegram.bots || status.telegram.bots.length === 0 ? (
                <p className="ngrok-empty-bots">
                  No Telegram bots currently connected. Connect a Telegram bot using the
                  &quot;Connect your accounts&quot; panel below.
                </p>
              ) : (
                <div className="ngrok-bots-list">
                  {status.telegram.bots.map((bot) => (
                    <div className="ngrok-bot-item" key={bot.id}>
                      <div className="ngrok-bot-item-info">
                        <span className="channel-icon telegram-bot">➤</span>
                        <div>
                          <strong>{bot.label}</strong>
                          {bot.webhookUrl ? (
                            <small className="ngrok-bot-url">{bot.webhookUrl}</small>
                          ) : (
                            <small className="ngrok-bot-none">No active webhook registered</small>
                          )}
                        </div>
                      </div>
                      <div className="ngrok-bot-item-status">
                        {bot.synced ? (
                          <span className="ngrok-synced-badge">✓ Webhook Active</span>
                        ) : (
                          <span className="ngrok-unsynced-badge">
                            {isActive ? "Not Synced" : "Offline"}
                          </span>
                        )}
                        {bot.lastError && (
                          <small className="ngrok-bot-error">{bot.lastError}</small>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="ngrok-field-copy-row" style={{ marginTop: "1rem" }}>
              <label style={{ width: "100%" }}>
                <span className="ngrok-field-label">Telegram Webhook Secret:</span>
                <div className="ngrok-field-copy-row">
                  <input
                    readOnly
                    type="password"
                    value={status?.telegram.secret || ""}
                    className="ngrok-code-input"
                  />
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => copyText(status?.telegram.secret || "", "tgSecret")}
                  >
                    {copyFeedback === "tgSecret" ? "✓ Copied" : "Copy"}
                  </button>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Tab 3: Settings */}
        {activeTab === "settings" && (
          <div className="ngrok-tab-panel">
            <form onSubmit={handleSaveSettingsSubmit} className="ngrok-settings-form">
              <h4>Tunnel Port & Domain</h4>
              <div className="ngrok-form-row">
                <label>
                  Local Port
                  <input
                    type="number"
                    value={targetPort}
                    onChange={(e) => setTargetPort(e.target.value)}
                    placeholder="8000"
                  />
                </label>
                <label>
                  Custom Domain (Optional, paid ngrok plan)
                  <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="my-subdomain.ngrok-free.app"
                  />
                </label>
              </div>

              {!isActive && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleStartWithCustomPort}
                  disabled={isStarting}
                  style={{ marginBottom: "1.5rem" }}
                >
                  Apply & Start on Port {targetPort || 8000}
                </button>
              )}

              <h4>Webhook Secrets</h4>
              <label>
                WhatsApp Verify Token
                <input
                  type="text"
                  value={waVerifyToken}
                  onChange={(e) => setWaVerifyToken(e.target.value)}
                  placeholder="verify-token-string"
                />
              </label>

              <label>
                WhatsApp App Secret (from Meta App Settings &gt; Basic)
                <input
                  type="password"
                  value={waAppSecret}
                  onChange={(e) => setWaAppSecret(e.target.value)}
                  placeholder="Paste Meta App Secret"
                />
              </label>

              <label>
                Telegram Webhook Secret (URL-safe characters)
                <input
                  type="text"
                  value={tgSecret}
                  onChange={(e) => setTgSecret(e.target.value)}
                  placeholder="secret-token-string"
                />
              </label>

              <div className="ngrok-submit-row">
                <button type="submit" className="primary-button" disabled={loading}>
                  {loading ? "Saving…" : "Save Secrets"}
                </button>
                {saveSuccess && (
                  <span className="ngrok-save-success">✓ Settings saved successfully!</span>
                )}
              </div>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
