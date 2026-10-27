import { NextResponse } from "next/server";
import { requireLocalUser } from "@/lib/server/auth";
import {
  getNgrokStatus,
  saveWebhookSettings,
  startNgrok,
  stopNgrok,
  syncAllTelegramBotWebhooks,
  testWhatsAppWebhookVerification,
} from "@/lib/server/ngrok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireLocalUser();
    const status = await getNgrokStatus();
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not retrieve ngrok status.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await requireLocalUser();
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || !("action" in body)) {
      return NextResponse.json({ error: "Missing action in request body." }, { status: 400 });
    }

    const payload = body as {
      action: string;
      port?: number;
      domain?: string;
      whatsappVerifyToken?: string;
      whatsappAppSecret?: string;
      telegramSecret?: string;
    };
    const { action } = payload;

    if (action === "start") {
      const status = await startNgrok({ port: payload.port, domain: payload.domain });
      return NextResponse.json(status);
    }

    if (action === "stop") {
      const status = await stopNgrok();
      return NextResponse.json(status);
    }

    if (action === "sync") {
      const current = await getNgrokStatus();
      if (!current.publicUrl) {
        return NextResponse.json(
          { error: "Cannot sync webhooks: ngrok tunnel is not active." },
          { status: 400 },
        );
      }
      await syncAllTelegramBotWebhooks(current.publicUrl);
      const updated = await getNgrokStatus();
      return NextResponse.json(updated);
    }

    if (action === "save_settings") {
      saveWebhookSettings({
        whatsappVerifyToken: payload.whatsappVerifyToken,
        whatsappAppSecret: payload.whatsappAppSecret,
        telegramSecret: payload.telegramSecret,
      });

      const current = await getNgrokStatus();
      if (current.publicUrl) {
        await syncAllTelegramBotWebhooks(current.publicUrl);
      }
      const updated = await getNgrokStatus();
      return NextResponse.json(updated);
    }

    if (action === "test_whatsapp") {
      const result = await testWhatsAppWebhookVerification();
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action failed.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
