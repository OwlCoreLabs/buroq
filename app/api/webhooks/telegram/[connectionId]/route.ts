import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { getConnection, receiveTelegramBotUpdate } from "@/lib/server/connections";
import { getTelegramWebhookSecret } from "@/lib/server/ngrok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function matchesWebhookSecret(expected: string | undefined, supplied: string | null) {
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  const expectedSecret = getTelegramWebhookSecret();
  const suppliedSecret = request.headers.get("x-telegram-bot-api-secret-token");
  const authenticated = matchesWebhookSecret(expectedSecret, suppliedSecret);
  if (!authenticated) {
    return NextResponse.json({ error: "Webhook authentication failed." }, { status: 401 });
  }

  const { connectionId } = await context.params;
  const connection = getConnection(connectionId);
  if (!connection || connection.kind !== "telegram-bot" || connection.status !== "connected") {
    return NextResponse.json({ error: "Telegram connection not found." }, { status: 404 });
  }

  try {
    const update: unknown = await request.json();
    if (typeof update !== "object" || update === null || Array.isArray(update)) {
      return NextResponse.json({ error: "Invalid Telegram update." }, { status: 400 });
    }
    await receiveTelegramBotUpdate(
      connection,
      update as Parameters<typeof receiveTelegramBotUpdate>[1],
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook update failed", error);
    return NextResponse.json({ error: "Telegram update failed." }, { status: 500 });
  }
}
// ponytail: keep webhook handling synchronous; add a queue only if provider retries become measurable.
