import type { FormEvent } from "react";

import { channelLabels, type Conversation } from "@/lib/inbox";

import { formatTime } from "./common";

type ConversationDetailProps = {
  conversation: Conversation | null;
  reply: string;
  busy: boolean;
  onReplyChange: (value: string) => void;
  onSendReply: (event: FormEvent<HTMLFormElement>) => void;
};

export function ConversationDetail({
  conversation,
  reply,
  busy,
  onReplyChange,
  onSendReply,
}: ConversationDetailProps) {
  if (!conversation) {
    return (
      <div className="conversation-detail">
        <div className="detail-empty">
          <span className="empty-inbox-icon">↗</span>
          <strong>Select a message</strong>
          <p>Choose a conversation to read and reply.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="conversation-detail">
      <header className="detail-header">
        <span className={`contact-avatar detail-avatar ${conversation.channel}`}>
          {conversation.title.slice(0, 1).toUpperCase()}
        </span>
        <div className="detail-contact">
          <strong>{conversation.title}</strong>
          <span>{conversation.handle}</span>
        </div>
        <span className="detail-channel">{channelLabels[conversation.channel]}</span>
      </header>

      <div className="message-area">
        {conversation.messages.map((message) => (
          <div className={`message-row ${message.direction}`} key={message.id}>
            <div className="message-content">
              <div className="message-meta">
                <strong>{message.direction === "outbound" ? "You" : conversation.title}</strong>
                <time>{formatTime(message.createdAt)}</time>
              </div>
              <div className="message-bubble">{message.body}</div>
            </div>
          </div>
        ))}
      </div>

      <form className="reply-box" onSubmit={onSendReply}>
        <textarea
          aria-label="Write a reply"
          placeholder={`Reply to ${conversation.title}…`}
          value={reply}
          onChange={(event) => onReplyChange(event.target.value)}
          maxLength={4096}
        />
        <div className="reply-footer">
          <span>Replies send via {channelLabels[conversation.channel]}</span>
          <button className="send-button" type="submit" disabled={busy || !reply.trim()}>
            {busy ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
