import { z } from "zod";

const optionalString = z.preprocess((value) => (value === "" ? undefined : value), z.string().optional());
const optionalUrl = z.preprocess((value) => (value === "" ? undefined : value), z.string().url().optional());

const envSchema = z.object({
  SPOTIFY_CLIENT_ID: optionalString,
  SPOTIFY_CLIENT_SECRET: optionalString,
  ANTHROPIC_API_KEY: optionalString,
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalString,
  SUPABASE_URL: optionalUrl,
  SUPABASE_ANON_KEY: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  NEXTAUTH_URL: optionalUrl,
  NEXTAUTH_SECRET: optionalString,
  CRON_SECRET: optionalString
});

export type ServerEnv = z.infer<typeof envSchema>;

export function getServerEnv(): ServerEnv {
  return envSchema.parse(process.env);
}

export function hasSupabaseConfig(): boolean {
  const env = getServerEnv();
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}

export function getSupabaseUrl(): string | undefined {
  const env = getServerEnv();
  return env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
}

export function getSupabasePublishableKey(): string | undefined {
  const env = getServerEnv();
  return env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY;
}
