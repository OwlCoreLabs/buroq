import { channelLabels, type ChannelConnection, type ChannelKind } from "@/lib/inbox";

import { channelKinds } from "./common";

type ConnectionPanelProps = {
  connections: ChannelConnection[];
  onOpenConnectionModal: (kind: ChannelKind) => void;
  onResetConnectionFlow: () => void;
};

export function ConnectionPanel({
  connections,
  onOpenConnectionModal,
  onResetConnectionFlow,
}: ConnectionPanelProps) {
  return (
    <section className="connection-panel" aria-label="Connect messaging accounts">
      <div className="connection-panel-heading">
        <div>
          <h2>Connect your accounts</h2>
          <p>Each provider account connects separately to this local inbox.</p>
        </div>
      </div>
      <div className="connection-options">
        {channelKinds.map((kind) => (
          <article className="connection-option" key={kind}>
            <span className={`channel-icon large ${kind}`}>
              {kind === "whatsapp-business" ? "W" : "➤"}
            </span>
            <div className="connection-option-copy"> 
              <strong>{channelLabels[kind]}</strong>
              <span>
                {connections.some((connection) => connection.kind === kind)
                  ? "Connected"
                  : "Not connected"}
              </span>
            </div>
            <button
              className="connect-button"
              type="button"
              onClick={() => {
                onResetConnectionFlow();
                onOpenConnectionModal(kind);
              }}
            >
              {connections.some((connection) => connection.kind === kind) ? "Add account" : "Connect"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
