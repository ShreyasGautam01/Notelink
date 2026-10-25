import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const isSupabaseConfigured = Boolean(url && publishableKey);
let client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (!url || !publishableKey) {
    throw new Error("Supabase is not configured. Add the project URL and publishable key to .env.local.");
  }
  if (!client) {
    client = createClient<Database>(url, publishableKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
    });
  }
  return client;
}
