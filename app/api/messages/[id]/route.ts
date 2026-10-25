import { NextResponse } from "next/server";

import { requireLocalUser } from "@/lib/server/auth";
import { getConnection, sendTelegramPersonal } from "@/lib/server/connections";
import { deleteStoredMessage, getMessage } from "@/lib/server/messages";
import { deleteImage } from "@/lib/server/media";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLocalUser();
    const messageId = Number((await context.params).id);
    if (!Number.isSafeInteger(messageId) || messageId < 1) {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }

    const message = getMessage(messageId);
    if (!message) return NextResponse.json({ error: "Message not found." }, { status: 404 });
    const connection = getConnection(message.connectionId);
    if (!connection) return NextResponse.json({ error: "Connection not found." }, { status: 404 });

    if (message.direction === "outbound" && connection.kind === "telegram-personal") {
      await sendTelegramPersonal(
        connection,
        message.providerChatId,
        "",
        null,
        message.providerMessageId,
      );
    } else if (message.direction === "inbound") {
      return NextResponse.json(
        { error: "Only sent messages can be deleted from providers." },
        { status: 409 },
      );
    }

    const deleted = deleteStoredMessage(messageId);
    await deleteImage(deleted?.mediaUrl);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Message could not be deleted.";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 502 },
    );
  }
}
