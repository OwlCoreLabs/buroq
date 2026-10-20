import type { ChannelKind } from "@/lib/inbox";

type TopBarProps = {
  onRefresh: () => void;
  onOpenConnect: (kind: ChannelKind) => void;
};

export function TopBar({ onRefresh, onOpenConnect }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="breadcrumbs">
        <strong>Inbox</strong>
      </div>
      <div className="topbar-actions">
        <span className="local-only-badge">Stored on this device</span>
        <button className="secondary-button" type="button" onClick={() => void onRefresh()}>
          Refresh messages
        </button>
      </div>
    </header>
  );
}
