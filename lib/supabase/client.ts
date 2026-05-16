"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "../env";

export function createSupabaseBrowserClient(): SupabaseClient | null {
  const env = getPublicEnv();
  if (!env.supabaseUrl || !env.supabaseAnonKey) return null;
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
