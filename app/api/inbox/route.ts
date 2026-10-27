import { NextResponse } from "next/server";
import { requireLocalUser } from "@/lib/server/auth";
import {
  ensureTelegramBotWebhook,
  getConnections,
  isTelegramWebhookEnabled,
  pollTelegramBot,
  syncTelegramPersonal,
} from "@/lib/server/connections"; // TODO: remove polling after personal Telegram listener exists.
import { database, type StoredConnection } from "@/lib/server/database";
import { listConversations, listMessages, markConversationRead } from "@/lib/server/messages";

export async function GET(request: Request) {
  try {
    await requireLocalUser();
    const url = new URL(request.url);
    const connectionId = url.searchParams.get("connectionId");
    const connectionRows = database()
      .prepare(
        "SELECT id, kind, label, credentials, status FROM connections WHERE status = 'connected'",
      )
      .all() as StoredConnection[];

    const syncWarnings: string[] = [];
    for (const connection of connectionRows) {
      try {
        if (connection.kind === "telegram-bot") {
          if (isTelegramWebhookEnabled()) await ensureTelegramBotWebhook(connection);
          else await pollTelegramBot(connection);
        }
        if (connection.kind === "telegram-personal") await syncTelegramPersonal(connection);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Unknown sync error.";
        syncWarnings.push(`${connection.label}: ${reason}`);
      }
    }

    const conversations = listConversations() as Array<{ id: number; connectionId: string }>;
    const conversationData = conversations
      .filter((conversation) => !connectionId || conversation.connectionId === connectionId)
      .map((conversation) => ({
        ...conversation,
        messages: listMessages(conversation.id),
      }));

    return NextResponse.json({
      connections: getConnections(),
      conversations: conversationData,
      syncWarnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load inbox messages.";
    const status = message === "Unauthorized" ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await requireLocalUser();
    const body: unknown = await request.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("conversationId" in body) ||
      typeof body.conversationId !== "number"
    ) {
      return NextResponse.json({ error: "Choose a conversation." }, { status: 400 });
    }
    markConversationRead(body.conversationId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the conversation.";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 400 },
    );
  }
}
