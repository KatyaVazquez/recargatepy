/**
 * Cliente de Supabase para el navegador (componentes cliente).
 * Usa la publishable key, sujeta a RLS.
 */
import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export function createClient() {
  return createBrowserClient(env.supabaseUrl, env.supabasePublishableKey);
}
