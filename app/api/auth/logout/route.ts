import { NextResponse } from "next/server";
import { logoutLocalAccount } from "@/lib/server/auth";

export async function POST() {
  await logoutLocalAccount();
  return NextResponse.json({ ok: true });
}
