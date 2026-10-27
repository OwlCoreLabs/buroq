import Image from "next/image";
import { useRef, useState, type SubmitEvent } from "react";

import { channelLabels, type Conversation } from "@/lib/inbox";

import { formatTime } from "./common";

type ConversationDetailProps = {
  conversation: Conversation | null;
  reply: string;
  busy: boolean;
  onReplyChange: (value: string) => void;
  onSendReply: (event: SubmitEvent<HTMLFormElement>, image?: File) => Promise<boolean>;
  onDeleteMessage: (messageId: number) => void;
};

export function ConversationDetail({
  conversation,
  reply,
  busy,
  onReplyChange,
  onSendReply,
  onDeleteMessage,
}: ConversationDetailProps) {
  const imageInput = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<File | null>(null);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const sent = await onSendReply(event, image ?? undefined);
    if (!sent) return;
    setImage(null);
    if (imageInput.current) imageInput.current.value = "";
  }

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
          <span className="avatar-letter">{conversation.title.slice(0, 1).toUpperCase()}</span>
          <span className="avatar-presence" aria-hidden="true" />
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
              <div className="message-bubble">
                {message.mediaUrl && (
                  <Image
                    className="message-image"
                    src={message.mediaUrl}
                    alt={message.mediaName ?? "Attached image"}
                    width={360}
                    height={270}
                    unoptimized
                  />
                )}
                {message.body && <p className="message-text">{message.body}</p>}
                <div className="message-actions">
                  <span className="message-status">
                    {message.direction === "outbound" ? "Sent" : "Received"}
                  </span>
                  {message.direction === "outbound" && (
                    <button
                      className="message-delete"
                      type="button"
                      aria-label="Delete message"
                      title="Delete message"
                      onClick={() => onDeleteMessage(message.id)}
                      disabled={busy}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M5 7h14M10 11v6M14 11v6M9 7V5h6v2m-8 0 1 13h8l1-13" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <form className="reply-box" onSubmit={handleSubmit}>
        {image && <p className="attachment-preview">{image.name}</p>}
        <textarea
          aria-label="Write a reply"
          placeholder={`Reply to ${conversation.title}…`}
          value={reply}
          onChange={(event) => onReplyChange(event.target.value)}
          maxLength={4096}
        />
        <div className="reply-footer">
          <input
            ref={imageInput}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            hidden
            onChange={(event) => setImage(event.target.files?.[0] ?? null)}
          />
          <button
            className="attach-button"
            type="button"
            onClick={() => imageInput.current?.click()}
          >
            Image
          </button>
          <span>Replies send via {channelLabels[conversation.channel]}</span>
          <button
            className="send-button"
            type="submit"
            disabled={busy || (!reply.trim() && !image)}
          >
            {busy ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
