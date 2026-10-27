import Link from "next/link";

import { channelLabels, type ChannelConnection, type ChannelKind } from "@/lib/inbox";

type SidebarProps = {
  username: string;
  connections: ChannelConnection[];
  activeFilter: "all" | string;
  onOpenConnect: (kind: ChannelKind) => void;
  onSelectFilter: (nextFilter: "all" | string) => void;
  onDisconnect: (connection: ChannelConnection) => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
};

export function Sidebar({
  username,
  connections,
  activeFilter,
  onOpenConnect,
  onSelectFilter,
  onDisconnect,
  onSignOut,
  onDeleteAccount,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <Link className="brand" href="/" aria-label="Buroq">
        <span className="brand-mark">b</span>
        <span>buroq</span>
      </Link>

      <div className="sidebar-section-heading">
        <p className="nav-label">CONNECTED ACCOUNTS</p>
        <button
          className="icon-button"
          type="button"
          aria-label="Connect an account"
          onClick={() => onOpenConnect("whatsapp-business")}
        >
          +
        </button>
      </div>

      <div className="account-list">
        {connections.length === 0 && (
          <p className="sidebar-empty">Connect an account to see its messages.</p>
        )}
        {connections.map((connection) => (
          <div className="account-row" key={connection.id}>
            <span className={`channel-icon ${connection.kind}`}>
              {connection.kind === "whatsapp-business" ? "W" : "➤"}
            </span>
            <button
              className={`account-filter ${activeFilter === connection.id ? "active" : ""}`}
              type="button"
              onClick={() => onSelectFilter(activeFilter === connection.id ? "all" : connection.id)}
            >
              <span>{connection.label}</span>
              <small>{channelLabels[connection.kind]}</small>
            </button>
            <button
              className="disconnect-button"
              type="button"
              aria-label={`Disconnect ${connection.label}`}
              onClick={() => void onDisconnect(connection)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="sidebar-bottom">
        <div className="local-profile">
          <span className="profile-avatar">{username.slice(0, 1).toUpperCase()}</span>
          <span className="profile-name">
            <strong>{username}</strong>
            <small>Local account</small>
          </span>
          <button className="text-button" type="button" onClick={() => void onSignOut()}>
            Sign out
          </button>
        </div>
        <button className="danger-link" type="button" onClick={onDeleteAccount}>
          Delete local account
        </button>
      </div>
    </aside>
  );
}
