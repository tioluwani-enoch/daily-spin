import { createHash } from "node:crypto";

import { getServerSession } from "next-auth";

import { getAuthOptions } from "@/lib/auth/options";
import { APP_BOOTSTRAP_USER_ID } from "@/lib/db/fixtures";
import { createServiceSupabaseClient } from "@/lib/db";

export function getDailySpinUserId(spotifyId: string): string {
  const hash = createHash("sha256").update(`daily-spin:${spotifyId}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function getCurrentDailySpinUserId(): Promise<string> {
  const session = await getServerSession(getAuthOptions());

  if (!session?.spotify?.id) {
    const existingUserId = await findExistingSyncedUserId(session?.user?.email ?? null, session?.user?.name ?? null);
    return existingUserId ?? APP_BOOTSTRAP_USER_ID;
  }

  return getDailySpinUserId(session.spotify.id);
}

async function findExistingSyncedUserId(email: string | null, displayName: string | null): Promise<string | null> {
  const supabase = createServiceSupabaseClient();

  if (!supabase || (!email && !displayName)) {
    return null;
  }

  if (email) {
    const { data } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
    if (data?.id) {
      return data.id;
    }
  }

  if (displayName) {
    const { data } = await supabase.from("users").select("id").eq("display_name", displayName).maybeSingle();
    return data?.id ?? null;
  }

  return null;
}
