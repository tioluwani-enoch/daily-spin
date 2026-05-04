import { redirect } from "next/navigation";

import { markDismissed } from "@/modules/morning-pick";

export async function POST(request: Request) {
  const form = await request.formData();
  const pickId = String(form.get("pickId") ?? "");
  await markDismissed(pickId);
  redirect("/");
}
