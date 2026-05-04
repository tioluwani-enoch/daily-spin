import { NextResponse } from "next/server";

import { markPlayed } from "@/modules/morning-pick";

export async function POST(request: Request) {
  const body = (await request.json()) as { pickId?: string };
  if (!body.pickId) {
    return NextResponse.json({ error: "pickId is required" }, { status: 400 });
  }

  await markPlayed(body.pickId);
  return NextResponse.json({ ok: true });
}
