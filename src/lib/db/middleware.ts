import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/env/server";

import type { Database } from "./types";

export async function updateSupabaseSession(request: NextRequest): Promise<NextResponse> {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabasePublishableKey();

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({
    request
  });

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  await supabase.auth.getUser();

  return response;
}
