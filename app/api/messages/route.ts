import { NextResponse } from "next/server";
import { requireLocalUser } from "@/lib/server/auth";
import {
  getConnection,
  sendTelegramBot,
  sendTelegramPersonal,
  sendWhatsAppBusiness,
} from "@/lib/server/connections";
import { database } from "@/lib/server/database";
import { getConversation, saveMessage } from "@/lib/server/messages";

export async function POST(request: Request) {
  try {
    await requireLocalUser();
    const body: unknown = await request.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("conversationId" in body) ||
      !("body" in body) ||
      typeof body.conversationId !== "number" ||
      typeof body.body !== "string"
    ) {
      return NextResponse.json(
        { error: "Choose a conversation and enter a message." },
        { status: 400 },
      );
    }

    const messageBody = body.body.trim();
    if (messageBody.length === 0 || messageBody.length > 4096) {
      return NextResponse.json(
        { error: "Messages must contain between 1 and 4096 characters." },
        { status: 400 },
      );
    }

    const conversation = getConversation(body.conversationId);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }
    const connection = getConnection(conversation.connectionId);
    if (!connection || connection.status !== "connected") {
      return NextResponse.json(
        { error: "The channel connection is unavailable." },
        { status: 409 },
      );
    }

    let providerMessageId: string;
    let sentAt = Date.now();
    if (connection.kind === "whatsapp-business") {
      providerMessageId = await sendWhatsAppBusiness(
        connection,
        conversation.providerChatId,
        messageBody,
      );
    } else if (connection.kind === "telegram-bot") {
      const result = await sendTelegramBot(connection, conversation.providerChatId, messageBody);
      providerMessageId = String(result.message_id);
      sentAt = result.date * 1000;
    } else {
      const sent = await sendTelegramPersonal(connection, conversation.providerChatId, messageBody);
      providerMessageId = sent;
    }

    if (connection.kind !== "telegram-personal") {
      saveMessage({
        connectionId: connection.id,
        providerChatId: conversation.providerChatId,
        title: conversation.title,
        handle: conversation.handle,
        providerMessageId,
        body: messageBody,
        direction: "outbound",
        createdAt: sentAt,
      });
    }

    const savedMessage = database()
      .prepare(
        `SELECT id, provider_message_id AS providerMessageId, body, direction,
                created_at AS createdAt
         FROM messages
         WHERE conversation_id = ? AND provider_message_id = ?`,
      )
      .get(conversation.id, providerMessageId);
    return NextResponse.json({ message: savedMessage }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Message could not be sent.";
    const status = message === "Unauthorized" ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
