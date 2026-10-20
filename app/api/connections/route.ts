import { NextResponse } from "next/server";
import { requireLocalUser } from "@/lib/server/auth";
import {
  connectTelegramBot,
  connectWhatsAppBusiness,
  getConnections,
  startTelegramPersonal,
} from "@/lib/server/connections";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not connect the account.";
  return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
}

export async function GET() {
  try {
    await requireLocalUser();
    return NextResponse.json({ connections: getConnections() });
  } catch {
    return NextResponse.json({ error: "Sign in to view connections." }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await requireLocalUser();
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || !("kind" in body)) {
      return NextResponse.json({ error: "Choose a connection type." }, { status: 400 });
    }

    if (body.kind === "whatsapp-business") {
      if (
        !("phoneNumberId" in body) ||
        !("accessToken" in body) ||
        typeof body.phoneNumberId !== "string" ||
        typeof body.accessToken !== "string"
      ) {
        return NextResponse.json(
          { error: "Enter the WhatsApp phone number ID and access token." },
          { status: 400 },
        );
      }
      const id = await connectWhatsAppBusiness(body.phoneNumberId, body.accessToken);
      return NextResponse.json({ id }, { status: 201 });
    }

    if (body.kind === "telegram-bot") {
      if (!("token" in body) || typeof body.token !== "string") {
        return NextResponse.json({ error: "Enter the Telegram bot token." }, { status: 400 });
      }
      const id = await connectTelegramBot(body.token);
      return NextResponse.json({ id }, { status: 201 });
    }

    if (body.kind === "telegram-personal") {
      if (!("phoneNumber" in body) || typeof body.phoneNumber !== "string") {
        return NextResponse.json({ error: "Enter your Telegram phone number." }, { status: 400 });
      }
      const result = await startTelegramPersonal(body.phoneNumber);
      return NextResponse.json(result, { status: 201 });
    }

    return NextResponse.json({ error: "Unsupported connection type." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
