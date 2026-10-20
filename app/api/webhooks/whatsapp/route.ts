import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { database } from "@/lib/server/database";
import { readCredentials } from "@/lib/server/connections";
import { saveMessage } from "@/lib/server/messages";

export async function GET(request: Request) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!verifyToken) {
    return NextResponse.json(
      { error: "WhatsApp webhook verification is not configured." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ error: "Webhook verification failed." }, { status: 403 });
}

export async function POST(request: Request) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    return NextResponse.json(
      { error: "WhatsApp webhook signature validation is not configured." },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const suppliedSignature = request.headers.get("x-hub-signature-256")?.replace(/^sha256=/, "");
  if (!suppliedSignature || !/^[a-f\d]{64}$/i.test(suppliedSignature)) {
    return NextResponse.json({ error: "Missing or invalid webhook signature." }, { status: 401 });
  }

  const expectedSignature = createHmac("sha256", appSecret).update(rawBody).digest();
  const actualSignature = Buffer.from(suppliedSignature, "hex");
  if (!timingSafeEqual(expectedSignature, actualSignature)) {
    return NextResponse.json({ error: "Webhook signature verification failed." }, { status: 401 });
  }

  let payload: {
    entry?: Array<{
      changes?: Array<{
        value?: {
          metadata?: { phone_number_id?: string };
          contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
          messages?: Array<{
            id?: string;
            from?: string;
            timestamp?: string;
            type?: string;
            text?: { body?: string };
          }>;
        };
      }>;
    }>;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid webhook JSON." }, { status: 400 });
  }

  const connections = database()
    .prepare(
      "SELECT id, kind, label, credentials, status FROM connections WHERE kind = 'whatsapp-business' AND status = 'connected'",
    )
    .all() as Array<{
    id: string;
    kind: "whatsapp-business";
    label: string;
    credentials: string;
    status: string;
  }>;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;
      const connection = connections.find(
        (item) => readCredentials<{ phoneNumberId: string }>(item).phoneNumberId === phoneNumberId,
      );
      if (!connection) continue;

      for (const message of value?.messages ?? []) {
        if (!message.id || !message.from || !message.timestamp || !message.text?.body) {
          if (message.type && message.type !== "text") {
            console.warn(`Ignoring unsupported WhatsApp message type: ${message.type}`);
          }
          continue;
        }
        const contact = value.contacts?.find((item) => item.wa_id === message.from);
        saveMessage({
          connectionId: connection.id,
          providerChatId: message.from,
          title: contact?.profile?.name ?? message.from,
          handle: message.from,
          providerMessageId: message.id,
          body: message.text.body,
          direction: "inbound",
          createdAt: Number(message.timestamp) * 1000,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
