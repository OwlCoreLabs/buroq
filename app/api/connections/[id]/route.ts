import { NextResponse } from "next/server";
import { requireLocalUser } from "@/lib/server/auth";
import { disconnectConnection, getConnection } from "@/lib/server/connections";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLocalUser();
    const { id } = await context.params;
    const connection = getConnection(id);
    if (!connection) return NextResponse.json({ error: "Connection not found." }, { status: 404 });
    await disconnectConnection(connection);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not disconnect the account.";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 502 },
    );
  }
}
