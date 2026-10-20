import { NextResponse } from "next/server";
import { requireLocalUser } from "@/lib/server/auth";
import { verifyTelegramPersonal } from "@/lib/server/connections";

export async function POST(request: Request) {
  try {
    await requireLocalUser();
    const body: unknown = await request.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("connectionId" in body) ||
      !("code" in body) ||
      typeof body.connectionId !== "string" ||
      typeof body.code !== "string"
    ) {
      return NextResponse.json({ error: "Enter the Telegram login code." }, { status: 400 });
    }
    const password =
      "password" in body && typeof body.password === "string" ? body.password : undefined;
    return NextResponse.json(await verifyTelegramPersonal(body.connectionId, body.code, password));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not verify Telegram login.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
