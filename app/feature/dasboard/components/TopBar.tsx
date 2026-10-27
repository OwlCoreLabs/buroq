import type { ChannelKind, NgrokStatus } from "@/lib/inbox";

type TopBarProps = {
  onRefresh: () => void;
  onOpenConnect?: (kind: ChannelKind) => void;
  ngrokStatus?: NgrokStatus | null;
  onOpenNgrokModal?: () => void;
};

export function TopBar({ onRefresh, ngrokStatus, onOpenNgrokModal }: TopBarProps) {
  const isNgrokActive = ngrokStatus?.active && Boolean(ngrokStatus.publicUrl);
  const isNgrokStarting = ngrokStatus?.status === "starting";

  return (
    <header className="topbar">
      <div className="breadcrumbs">
        <strong>Inbox</strong>
      </div>
      <div className="topbar-actions">
        {onOpenNgrokModal && (
          <button
            type="button"
            className={`topbar-ngrok-btn ${isNgrokActive ? "active" : isNgrokStarting ? "starting" : "inactive"}`}
            onClick={onOpenNgrokModal}
            title={
              isNgrokActive
                ? `ngrok tunnel active (${ngrokStatus?.publicUrl}). Click to manage webhooks.`
                : "ngrok tunnel offline. Click to activate."
            }
          >
            <span
              className={`ngrok-status-dot ${isNgrokActive ? "active" : isNgrokStarting ? "starting" : "inactive"}`}
            />
            <span className="topbar-ngrok-text">
              {isNgrokActive ? "ngrok: Live" : isNgrokStarting ? "ngrok: Starting…" : "⚡ ngrok"}
            </span>
          </button>
        )}
        <span className="local-only-badge">Stored on this device</span>
        <button className="secondary-button" type="button" onClick={() => void onRefresh()}>
          Refresh messages
        </button>
      </div>
    </header>
  );
}
