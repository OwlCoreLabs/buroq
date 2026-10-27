import { channelLabels, type ChannelConnection, type Conversation } from "@/lib/inbox";

import { formatTime } from "./common";

type ConversationListProps = {
  connections: ChannelConnection[];
  conversations: Conversation[];
  loading: boolean;
  selectedId: number | null;
  activeFilter: "all" | string;
  search: string;
  onSearchChange: (value: string) => void;
  onSetActiveFilter: (value: "all" | string) => void;
  onSelectConversation: (conversation: Conversation) => void;
  onDeleteConversation: (conversation: Conversation) => void;
  deletingConversationId: number | null;
};

export function ConversationList({
  connections,
  conversations,
  loading,
  selectedId,
  activeFilter,
  search,
  onSearchChange,
  onSetActiveFilter,
  onSelectConversation,
  onDeleteConversation,
  deletingConversationId,
}: ConversationListProps) {
  return (
    <div className="inbox-list">
      <div className="inbox-list-heading">
        <div>
          <h2>
            Messages <span>{conversations.length}</span>
          </h2>
          <p>Real messages received by connected accounts</p>
        </div>
      </div>
      <label className="search-box">
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          placeholder="Search messages"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>
      <div className="filter-tabs" role="tablist" aria-label="Filter messages">
        <button
          className={`filter-tab ${activeFilter === "all" ? "active" : ""}`}
          type="button"
          role="tab"
          aria-selected={activeFilter === "all"}
          onClick={() => onSetActiveFilter("all")}
        >
          All
        </button>
        {connections.map((connection) => (
          <button
            className={`filter-tab ${activeFilter === connection.id ? "active" : ""}`}
            key={connection.id}
            type="button"
            role="tab"
            aria-selected={activeFilter === connection.id}
            onClick={() => onSetActiveFilter(connection.id)}
          >
            {connection.label}
          </button>
        ))}
      </div>
      <div className="conversation-list">
        {loading ? (
          <p className="empty-state">Loading messages…</p>
        ) : conversations.length === 0 ? (
          <div className="empty-state">
            <strong>{connections.length ? "No messages yet" : "No accounts connected"}</strong>
            <span>
              {connections.length
                ? "New messages received by your connected accounts will appear here."
                : "Connect WhatsApp Business or Telegram to load real messages."}
            </span>
          </div>
        ) : (
          conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`conversation-item ${selectedId === conversation.id ? "active" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => onSelectConversation(conversation)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectConversation(conversation);
                }
              }}
            >
              <span className={`contact-avatar ${conversation.channel}`}>
                <span className="avatar-letter">
                  {conversation.title.slice(0, 1).toUpperCase()}
                </span>
                <span className="avatar-presence" aria-hidden="true" />
              </span>
              <span className="conversation-copy">
                <span className="conversation-title">
                  <strong>{conversation.title}</strong>
                  <time>{formatTime(conversation.lastMessageAt)}</time>
                </span>
                <span className="conversation-preview">{conversation.preview}</span>
                <span className="conversation-meta">
                  <span>{channelLabels[conversation.channel]}</span>
                  {conversation.unreadCount > 0 && (
                    <span className="unread-pill">{conversation.unreadCount}</span>
                  )}
                </span>
              </span>
              <span
                className="conversation-delete-wrap"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  className="conversation-delete"
                  type="button"
                  aria-label={`Delete chat with ${conversation.title}`}
                  title={
                    deletingConversationId === conversation.id ? "Deleting chat" : "Delete chat"
                  }
                  disabled={deletingConversationId !== null}
                  onClick={() => onDeleteConversation(conversation)}
                >
                  {deletingConversationId === conversation.id ? (
                    <span className="delete-spinner" aria-hidden="true" />
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 7h14M10 11v6M14 11v6M9 7V5h6v2m-8 0 1 13h8l1-13" />
                    </svg>
                  )}
                </button>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
