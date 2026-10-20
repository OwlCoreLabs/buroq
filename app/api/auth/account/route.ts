import { NextResponse } from "next/server";
import { deleteLocalAccount, requireLocalUser } from "@/lib/server/auth";

export async function DELETE(request: Request) {
  try {
    await requireLocalUser();
    const body: unknown = await request.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("password" in body) ||
      typeof body.password !== "string"
    ) {
      return NextResponse.json(
        { error: "Enter your password to delete the account." },
        { status: 400 },
      );
    }

    await deleteLocalAccount(body.password);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete the local account.";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 400 },
    );
  }
}
