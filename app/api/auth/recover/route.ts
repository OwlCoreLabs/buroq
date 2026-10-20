import { NextResponse } from "next/server";
import { resetLocalPassword } from "@/lib/server/auth";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("username" in body) ||
      !("recoveryCode" in body) ||
      !("password" in body) ||
      typeof body.username !== "string" ||
      typeof body.recoveryCode !== "string" ||
      typeof body.password !== "string"
    ) {
      return NextResponse.json(
        { error: "Enter your username, recovery code, and new password." },
        { status: 400 },
      );
    }

    await resetLocalPassword(body.username, body.recoveryCode, body.password);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reset the password.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
