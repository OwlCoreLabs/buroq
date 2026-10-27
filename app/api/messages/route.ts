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
    let conversationId: number | null = null;
    let connectionId: string | undefined;
    let providerChatId: string | undefined;
    let recipientTitle: string | undefined;
    let messageBody: string;
    let image: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const rawConversationId = formData.get("conversationId");
      conversationId = rawConversationId ? Number(rawConversationId) : null;
      connectionId = String(formData.get("connectionId") ?? "") || undefined;
      providerChatId = String(formData.get("providerChatId") ?? "") || undefined;
      recipientTitle = String(formData.get("recipientTitle") ?? "") || undefined;
      messageBody = String(formData.get("body") ?? "");
      const value = formData.get("image");
      image = value instanceof File && value.size > 0 ? value : null;
    } else {
      const body: unknown = await request.json();
      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return NextResponse.json(
          { error: "Choose a conversation or enter a recipient and message." },
          { status: 400 },
        );
      }
      const payload = body as Record<string, unknown>;
      conversationId = typeof payload.conversationId === "number" ? payload.conversationId : null;
      connectionId = typeof payload.connectionId === "string" ? payload.connectionId : undefined;
      providerChatId =
        typeof payload.providerChatId === "string" ? payload.providerChatId : undefined;
      recipientTitle =
        typeof payload.recipientTitle === "string" ? payload.recipientTitle : undefined;
      messageBody = typeof payload.body === "string" ? payload.body : "";
      if (
        typeof payload.body !== "string" ||
        (conversationId === null && (!connectionId || !providerChatId))
      ) {
        return NextResponse.json(
          { error: "Choose a conversation or enter a recipient and message." },
          { status: 400 },
        );
      }
    }

    if (
      (conversationId !== null && (!Number.isSafeInteger(conversationId) || conversationId < 1)) ||
      (conversationId === null &&
        (!connectionId || !providerChatId || !/^-?\d{1,20}$/.test(providerChatId)))
    ) {
      return NextResponse.json(
        { error: "Choose a conversation or enter a valid Telegram chat ID." },
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

    const conversation = conversationId === null ? null : getConversation(conversationId);
    if (conversationId !== null && !conversation) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }
    const connection = getConnection(connectionId ?? conversation!.connectionId);
    if (!connection || connection.status !== "connected") {
      return NextResponse.json(
        { error: "The channel connection is unavailable." },
        { status: 409 },
      );
    }

    const targetChatId = providerChatId ?? conversation!.providerChatId;
    const targetTitle = recipientTitle ?? conversation?.title ?? targetChatId;
    const targetHandle = conversation?.handle ?? "";
    let providerMessageId: string;
    let sentAt = Date.now();
    if (connection.kind === "whatsapp-business") {
      if (!conversation)
        return NextResponse.json({ error: "Choose an existing conversation." }, { status: 400 });
      providerMessageId = image
        ? await sendWhatsAppBusinessImage(connection, targetChatId, image, messageBody)
        : await sendWhatsAppBusiness(connection, targetChatId, messageBody);
    } else if (connection.kind === "telegram-bot") {
      const result = image
        ? await sendTelegramBotImage(connection, targetChatId, image, messageBody)
        : await sendTelegramBot(connection, targetChatId, messageBody);
      providerMessageId = String(result.message_id);
      sentAt = result.date * 1000;
    } else {
      if (!conversation)
        return NextResponse.json({ error: "Choose an existing conversation." }, { status: 400 });
      const sent = await sendTelegramPersonal(
        connection,
        targetChatId,
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
        providerChatId: targetChatId,
        title: targetTitle,
        handle: targetHandle,
        providerMessageId,
        body: messageBody || (image ? "Image" : ""),
        direction: "outbound",
        createdAt: sentAt,
        mediaUrl: mediaPath,
        mediaMimeType,
        mediaName,
      });
    }

    const savedMessage = conversation
      ? database()
          .prepare(
            `SELECT id, provider_message_id AS providerMessageId, body, direction,
                    created_at AS createdAt,
                    media_url AS mediaUrl,
                    media_mime_type AS mediaMimeType,
                    media_name AS mediaName
             FROM messages
             WHERE conversation_id = ? AND provider_message_id = ?`,
          )
          .get(conversation.id, providerMessageId)
      : null;
    return NextResponse.json({ message: savedMessage }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Message could not be sent.";
    const status = message === "Unauthorized" ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
