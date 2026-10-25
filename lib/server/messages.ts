import "server-only";

import { emitInboxUpdate } from "@/lib/socket";

import { mediaUrl } from "./media";
import { database } from "./database";

export type MessageDirection = "inbound" | "outbound";

export function saveMessage(input: {
  connectionId: string;
  providerChatId: string;
  title: string;
  handle?: string;
  providerMessageId: string;
  body: string;
  direction: MessageDirection;
  createdAt: number;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaName?: string;
}) {
  const db = database();
  const transaction = db.transaction(() => {
    db.prepare(
      `INSERT INTO conversations (connection_id, provider_chat_id, title, handle)
       VALUES (@connectionId, @providerChatId, @title, @handle)
       ON CONFLICT(connection_id, provider_chat_id) DO UPDATE SET
         title = excluded.title,
         handle = CASE WHEN excluded.handle = '' THEN conversations.handle ELSE excluded.handle END`,
    ).run({
      ...input,
      handle: input.handle ?? "",
    });

    const conversation = db
      .prepare("SELECT id FROM conversations WHERE connection_id = ? AND provider_chat_id = ?")
      .get(input.connectionId, input.providerChatId) as { id: number };

    const inserted = db
      .prepare(
        `INSERT OR IGNORE INTO messages
         (conversation_id, provider_message_id, body, direction, created_at, media_url, media_mime_type, media_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        conversation.id,
        input.providerMessageId,
        input.body,
        input.direction,
        input.createdAt,
        input.mediaUrl ?? null,
        input.mediaMimeType ?? null,
        input.mediaName ?? null,
      );

    if (inserted.changes === 1) {
      db.prepare(
        `UPDATE conversations SET
           last_message = ?,
           last_message_at = ?,
           unread_count = unread_count + ?
         WHERE id = ?`,
      ).run(input.body, input.createdAt, input.direction === "inbound" ? 1 : 0, conversation.id);
    }
    return { conversationId: conversation.id, inserted: inserted.changes === 1 };
  });

  const result = transaction();
  if (result.inserted) emitInboxUpdate();
  return result.conversationId;
  // ponytail: keep provider polling request-scoped; add a dedicated worker only if multiple providers need continuous sync.
}

export function listConversations() {
  return database()
    .prepare(
      `SELECT
         c.id,
         c.connection_id AS connectionId,
         c.provider_chat_id AS providerChatId,
         c.title,
         c.handle,
         c.last_message AS preview,
         c.last_message_at AS lastMessageAt,
         c.unread_count AS unreadCount,
         cn.kind AS channel
       FROM conversations c
       JOIN connections cn ON cn.id = c.connection_id
       ORDER BY c.last_message_at DESC`,
    )
    .all();
}

export function listMessages(conversationId: number) {
  return database()
    .prepare(
      `SELECT
         id,
         provider_message_id AS providerMessageId,
         body,
         direction,
         created_at AS createdAt,
         media_url AS mediaPath,
         media_mime_type AS mediaMimeType,
         media_name AS mediaName
       FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC, id ASC`,
    )
    .all(conversationId)
    .map((message) => {
      const row = message as { id: number; mediaPath?: string } & Record<string, unknown>;
      return {
        ...row,
        mediaUrl: row.mediaPath ? mediaUrl(row.mediaPath, row.id) : undefined,
        mediaPath: undefined,
      };
    });
}

export function getConversation(conversationId: number) {
  return database()
    .prepare(
      `SELECT
         c.id,
         c.connection_id AS connectionId,
         c.provider_chat_id AS providerChatId,
         c.title,
         c.handle,
         cn.kind AS channel
       FROM conversations c
       JOIN connections cn ON cn.id = c.connection_id
       WHERE c.id = ?`,
    )
    .get(conversationId) as
    | {
        id: number;
        connectionId: string;
        providerChatId: string;
        title: string;
        handle: string;
        channel: string;
      }
    | undefined;
}

export function markConversationRead(conversationId: number) {
  database().prepare("UPDATE conversations SET unread_count = 0 WHERE id = ?").run(conversationId);
}

export function getMessage(messageId: number) {
  return database()
    .prepare(
      `SELECT m.id, m.provider_message_id AS providerMessageId, m.body, m.direction,
              m.created_at AS createdAt, m.media_url AS mediaUrl, m.media_mime_type AS mediaMimeType,
              m.media_name AS mediaName, c.id AS conversationId, c.connection_id AS connectionId,
              c.provider_chat_id AS providerChatId
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE m.id = ?`,
    )
    .get(messageId) as
    | {
        id: number;
        providerMessageId: string;
        body: string;
        direction: MessageDirection;
        createdAt: number;
        mediaUrl?: string;
        mediaMimeType?: string;
        mediaName?: string;
        conversationId: number;
        connectionId: string;
        providerChatId: string;
      }
    | undefined;
}

export function deleteStoredMessage(messageId: number) {
  const message = getMessage(messageId);
  if (!message) return null;
  database().prepare("DELETE FROM messages WHERE id = ?").run(messageId);
  database()
    .prepare(
      `UPDATE conversations SET
         last_message = COALESCE((SELECT body FROM messages WHERE conversation_id = ? ORDER BY created_at DESC, id DESC LIMIT 1), ''),
         last_message_at = COALESCE((SELECT created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC, id DESC LIMIT 1), 0)
       WHERE id = ?`,
    )
    .run(message.conversationId, message.conversationId, message.conversationId);
  emitInboxUpdate();
  return message;
}
