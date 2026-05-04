import { redirect } from "next/navigation";

import { triageCapture } from "@/modules/capture-inbox";

export async function POST(request: Request) {
  const form = await request.formData();
  const captureId = String(form.get("captureId") ?? "");
  const action = String(form.get("action") ?? "");

  if (action === "for-later") {
    await triageCapture(captureId, { type: "for-later" });
  } else {
    await triageCapture(captureId, { type: "dismiss" });
  }

  redirect("/");
}
