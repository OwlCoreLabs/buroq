import { NextResponse } from "next/server";
import { createLocalAccount } from "@/lib/server/auth";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("username" in body) ||
      !("password" in body) ||
      typeof body.username !== "string" ||
      typeof body.password !== "string"
    ) {
      return NextResponse.json({ error: "Enter a username and password." }, { status: 400 });
    }

    const recoveryCode = await createLocalAccount(body.username, body.password);
    return NextResponse.json({ ok: true, recoveryCode });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create the local account.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
