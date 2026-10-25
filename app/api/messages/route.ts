import { NextResponse } from "next/server";
import { requireLocalUser } from "@/lib/server/auth";
import { saveImage } from "@/lib/server/media";
import {
  getConnection,
  sendTelegramBot,
  sendTelegramBotImage,
  sendTelegramPersonal,
  sendWhatsAppBusiness,
  sendWhatsAppBusinessImage,
} from "@/lib/server/connections";
import { database } from "@/lib/server/database";
import { getConversation, saveMessage } from "@/lib/server/messages";

export async function POST(request: Request) {
  try {
    await requireLocalUser();
    const contentType = request.headers.get("content-type") ?? "";
    let conversationId: number;
    let messageBody: string;
    let image: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      conversationId = Number(formData.get("conversationId"));
      messageBody = String(formData.get("body") ?? "");
      const value = formData.get("image");
      image = value instanceof File && value.size > 0 ? value : null;
    } else {
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
      conversationId = body.conversationId;
      messageBody = body.body;
    }

    if (!Number.isSafeInteger(conversationId) || conversationId < 1) {
      return NextResponse.json(
        { error: "Choose a conversation and enter a message." },
        { status: 400 },
      );
    }

    let mediaPath: string | undefined;
    let mediaMimeType: string | undefined;
    let mediaName: string | undefined;
    if (image) {
      mediaPath = await saveImage(Buffer.from(await image.arrayBuffer()), image.type);
      mediaMimeType = image.type;
      mediaName = image.name || "image";
    }
    messageBody = messageBody.trim();
    if (messageBody.length > 4096 || (messageBody.length === 0 && !image)) {
      return NextResponse.json(
        { error: "Enter a message or choose an image. Text must not exceed 4096 characters." },
        { status: 400 },
      );
    }

    const conversation = getConversation(conversationId);
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
      providerMessageId = image
        ? await sendWhatsAppBusinessImage(
            connection,
            conversation.providerChatId,
            image,
            messageBody,
          )
        : await sendWhatsAppBusiness(connection, conversation.providerChatId, messageBody);
    } else if (connection.kind === "telegram-bot") {
      const result = image
        ? await sendTelegramBotImage(connection, conversation.providerChatId, image, messageBody)
        : await sendTelegramBot(connection, conversation.providerChatId, messageBody);
      providerMessageId = String(result.message_id);
      sentAt = result.date * 1000;
    } else {
      const sent = await sendTelegramPersonal(
        connection,
        conversation.providerChatId,
        messageBody,
        image,
        undefined,
        mediaPath,
        mediaMimeType,
        mediaName,
      );
      providerMessageId = sent;
    }

    if (connection.kind !== "telegram-personal") {
      saveMessage({
        connectionId: connection.id,
        providerChatId: conversation.providerChatId,
        title: conversation.title,
        handle: conversation.handle,
        providerMessageId,
        body: messageBody || (image ? "Image" : ""),
        direction: "outbound",
        createdAt: sentAt,
        mediaUrl: mediaPath,
        mediaMimeType,
        mediaName,
      });
    }

    const savedMessage = database()
      .prepare(
        `SELECT id, provider_message_id AS providerMessageId, body, direction,
                created_at AS createdAt,
                media_url AS mediaUrl,
                media_mime_type AS mediaMimeType,
                media_name AS mediaName
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
