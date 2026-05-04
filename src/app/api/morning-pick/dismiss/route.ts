import { redirect } from "next/navigation";

import { getCurrentDailySpinUserId } from "@/lib/auth/user";
import { regenerateTodayPick } from "@/modules/morning-pick";

export async function POST(request: Request) {
  const form = await request.formData();
  const pickId = String(form.get("pickId") ?? "");
  const userId = await getCurrentDailySpinUserId();
  await regenerateTodayPick(userId, pickId);
  redirect("/");
}
