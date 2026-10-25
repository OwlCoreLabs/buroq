import { NextResponse } from "next/server";

import { requireLocalUser } from "@/lib/server/auth";
import { readImage } from "@/lib/server/media";
import { getMessage } from "@/lib/server/messages";

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  if (!(await isAuthenticated()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await context.params).name);
  if (!Number.isSafeInteger(id) || id < 1) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }
  const message = getMessage(id);

  if (!message?.mediaUrl || !message.mediaMimeType) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  try {
    const image = await readImage(message.mediaUrl);
    return new Response(image, {
      headers: {
        "Content-Type": message.mediaMimeType,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }
}

async function isAuthenticated() {
  try {
    await requireLocalUser();
    return true;
  } catch {
    return false;
  }
}
