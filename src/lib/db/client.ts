import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getServerEnv, getSupabasePublishableKey, getSupabaseUrl, hasSupabaseConfig } from "@/lib/env/server";

import type { Database } from "./types";

export async function createServerSupabaseClient() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(getSupabaseUrl()!, getSupabasePublishableKey()!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies; middleware refreshes sessions.
        }
      }
    }
  });
}

export function createBrowserSupabaseClient() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  return createBrowserClient<Database>(getSupabaseUrl()!, getSupabasePublishableKey()!);
}

export function createServiceSupabaseClient() {
  const env = getServerEnv();
  const supabaseUrl = getSupabaseUrl();

  if (!supabaseUrl || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return createClient<Database>(supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false
    }
  });
}
