/**
 * Cliente de Supabase con la clave secreta (service_role): BYPASSA RLS.
 *
 * Usar SOLO en el backend (route handlers del bot/PWA, scripts de mantenimiento).
 * Nunca importar desde código que corra en el navegador.
 *
 * Las operaciones del bot/PWA usan este cliente y SIEMPRE deben filtrar
 * `tenant_id` explícito en cada query (el aislamiento entre tenants se mantiene
 * en la capa de aplicación de forma visible, además del RLS como red de seguridad).
 */
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { serverEnv } from "@/lib/env";

export function createAdminClient() {
  return createClient(env.supabaseUrl, serverEnv().supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
