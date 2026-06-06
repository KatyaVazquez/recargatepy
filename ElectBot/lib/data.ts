/**
 * Loaders de datos del tenant. Usados por el bot (webhook) y la PWA para
 * armar el Contexto antes de operar. Usan el cliente admin (service_role).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Candidato, Jornada, Tenant, Usuario } from "@/lib/types";

type DB = SupabaseClient;

/** Carga un tenant por su slug (subdominio). Null si no existe o está suspendido. */
export async function getTenantBySlug(
  db: DB,
  slug: string
): Promise<Tenant | null> {
  const { data, error } = await db
    .from("tenants")
    .select("id, slug, nombre, cod_dpto, cod_dist, status")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.status !== "activo") return null;
  return data as Tenant;
}

/** Devuelve el token + secret del bot del tenant (solo backend). */
export async function getBotConfig(
  db: DB,
  tenantId: string
): Promise<{ token: string | null; webhookSecret: string | null }> {
  const { data, error } = await db
    .from("tenants")
    .select("telegram_bot_token, telegram_webhook_secret")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return {
    token: data?.telegram_bot_token ?? null,
    webhookSecret: data?.telegram_webhook_secret ?? null,
  };
}

/** La jornada activa del tenant (a lo sumo una). Null si no hay ninguna activa. */
export async function getJornadaActiva(
  db: DB,
  tenantId: string
): Promise<Jornada | null> {
  const { data, error } = await db
    .from("jornadas")
    .select("id, tenant_id, nombre, filtro_secciones, estado, correccion_ventana_minutos")
    .eq("tenant_id", tenantId)
    .eq("estado", "activa")
    .maybeSingle();
  if (error) throw error;
  return (data as Jornada) ?? null;
}

/** Busca un operador por su telegram_id dentro de un tenant. */
export async function getUsuarioPorTelegram(
  db: DB,
  tenantId: string,
  telegramId: number
): Promise<Usuario | null> {
  const { data, error } = await db
    .from("usuarios")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("telegram_id", telegramId)
    .maybeSingle();
  if (error) throw error;
  return (data as Usuario) ?? null;
}

/** Busca un operador por teléfono (para vincular al compartir contacto). */
export async function getUsuarioPorTelefono(
  db: DB,
  tenantId: string,
  telefono: string
): Promise<Usuario | null> {
  const { data, error } = await db
    .from("usuarios")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("telefono", telefono)
    .maybeSingle();
  if (error) throw error;
  return (data as Usuario) ?? null;
}

/** Carga un candidato por id (para mostrar el equipo del operador). Null si no tiene. */
export async function getCandidatoPorId(
  db: DB,
  candidatoId: string | null
): Promise<Candidato | null> {
  if (!candidatoId) return null;
  const { data, error } = await db
    .from("candidatos")
    .select("id, tenant_id, tipo, nombre, lista, opcion, orden")
    .eq("id", candidatoId)
    .maybeSingle();
  if (error) throw error;
  return (data as Candidato) ?? null;
}

/**
 * Qué canales están habilitados para el tenant (pueden ser ambos) y si el
 * sistema está encendido (interruptor maestro). Con `sistema` en false nadie
 * puede operar, sin importar los canales.
 */
export async function getCanalesActivos(
  db: DB,
  tenantId: string
): Promise<{ telegram: boolean; pwa: boolean; sistema: boolean }> {
  const { data, error } = await db
    .from("configuracion_operativa")
    .select("telegram_activo, pwa_activo, sistema_activo")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return {
    telegram: data?.telegram_activo ?? true,
    pwa: data?.pwa_activo ?? true,
    sistema: data?.sistema_activo ?? true,
  };
}
