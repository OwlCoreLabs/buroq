import { NextResponse } from "next/server";

import { requireLocalUser } from "@/lib/server/auth";
import { deleteImage } from "@/lib/server/media";
import { deleteStoredConversation } from "@/lib/server/messages";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLocalUser();
    const conversationId = Number((await context.params).id);
    if (!Number.isSafeInteger(conversationId) || conversationId < 1) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    const mediaPaths = deleteStoredConversation(conversationId);
    if (!mediaPaths)
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    await Promise.all(mediaPaths.map((mediaPath) => deleteImage(mediaPath)));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Conversation could not be deleted.";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 502 },
    );
  }
}
