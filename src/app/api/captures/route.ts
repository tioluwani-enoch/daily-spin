import { NextResponse } from "next/server";

import { APP_BOOTSTRAP_USER_ID } from "@/lib/db/fixtures";
import { createCapture } from "@/modules/capture-inbox";

export async function POST(request: Request) {
  const body = (await request.json()) as { rawInput?: string; source?: "bookmarklet" | "share" | "paste" | "companion" };

  if (!body.rawInput || !body.source) {
    return NextResponse.json({ error: "rawInput and source are required" }, { status: 400 });
  }

  const capture = await createCapture(APP_BOOTSTRAP_USER_ID, {
    rawInput: body.rawInput,
    source: body.source
  });

  return NextResponse.json({ capture }, { status: 201 });
}
