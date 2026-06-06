"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { getJornadaActiva } from "@/lib/data";
import { digitosTelefono } from "@/lib/telefono";
import { firmarTokenOperador } from "@/lib/token-operador";

export type FormState = { ok: boolean; message: string } | null;

/** Slug del tenant viajado en un hidden input <input name="slug">. */
function slugDeForm(formData: FormData): string {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) throw new Error("Falta slug en el form.");
  return slug;
}

/** Crea un operador (Mesa Guía o Veedor) en el tenant del admin. */
export async function crearOperador(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const slug = slugDeForm(formData);
  await requireAdmin(slug);
  const supabase = await createClient();

  const rol = String(formData.get("rol"));
  const telefono = digitosTelefono(String(formData.get("telefono") ?? ""));
  const nombre = String(formData.get("nombre") ?? "").trim() || null;
  const mesa = formData.get("mesa") ? Number(formData.get("mesa")) : null;
  const puesto = formData.get("puesto") ? Number(formData.get("puesto")) : null;
  const candidatoId = String(formData.get("candidato_id") ?? "") || null;

  if (!telefono) return { ok: false, message: "El teléfono es obligatorio." };
  if (rol !== "Mesa_Guia" && rol !== "Veedor" && rol !== "KP")
    return { ok: false, message: "Rol inválido." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const tenantId = (user?.app_metadata as { tenant_id?: string })?.tenant_id;
  if (!tenantId) return { ok: false, message: "Sesión inválida." };

  const { error } = await supabase.from("usuarios").insert({
    tenant_id: tenantId,
    telefono,
    nombre,
    rol,
    // El Veedor usa mesa (para validar y para el modo orden); KP no la necesita.
    mesa: rol === "Veedor" ? mesa : null,
    puesto: rol === "Mesa_Guia" ? puesto : null,
    // El candidato (equipo) aplica a Mesa Guía y KP; Veedor es común.
    candidato_id: rol === "Mesa_Guia" || rol === "KP" ? candidatoId : null,
  });

  if (error) {
    const dup = error.code === "23505";
    return {
      ok: false,
      message: dup ? "Ya existe un operador con ese teléfono." : "No se pudo crear.",
    };
  }

  revalidatePath(`/${slug}/admin`);
  return { ok: true, message: `${nombre ?? "Operador"} agregado.` };
}

/** Edita los datos de un operador (nombre, teléfono, rol, mesa/puesto, equipo). */
export async function editarOperador(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const slug = slugDeForm(formData);
  await requireAdmin(slug);
  const supabase = await createClient();

  const id = String(formData.get("id"));
  const rol = String(formData.get("rol"));
  const telefono = digitosTelefono(String(formData.get("telefono") ?? ""));
  const nombre = String(formData.get("nombre") ?? "").trim() || null;
  const mesa = formData.get("mesa") ? Number(formData.get("mesa")) : null;
  const puesto = formData.get("puesto") ? Number(formData.get("puesto")) : null;
  const candidatoId = String(formData.get("candidato_id") ?? "") || null;

  if (!telefono) return { ok: false, message: "El teléfono es obligatorio." };
  if (rol !== "Mesa_Guia" && rol !== "Veedor" && rol !== "KP")
    return { ok: false, message: "Rol inválido." };

  const { error } = await supabase
    .from("usuarios")
    .update({
      telefono,
      nombre,
      rol,
      mesa: rol === "Veedor" ? mesa : null,
      puesto: rol === "Mesa_Guia" ? puesto : null,
      candidato_id: rol === "Mesa_Guia" || rol === "KP" ? candidatoId : null,
    })
    .eq("id", id);

  if (error) {
    const dup = error.code === "23505";
    return {
      ok: false,
      message: dup ? "Ya existe un operador con ese teléfono." : "No se pudo actualizar.",
    };
  }

  revalidatePath(`/${slug}/admin`);
  return { ok: true, message: "Operador actualizado." };
}

/** Alterna el rol Mesa_Guia ↔ Veedor. Mesa/puesto se conservan por si vuelve. */
export async function alternarRol(formData: FormData) {
  const slug = slugDeForm(formData);
  await requireAdmin(slug);
  const supabase = await createClient();

  const id = String(formData.get("id"));
  const rolActual = String(formData.get("rol"));
  const nuevo = rolActual === "Veedor" ? "Mesa_Guia" : "Veedor";

  await supabase.from("usuarios").update({ rol: nuevo }).eq("id", id);
  revalidatePath(`/${slug}/admin`);
}

/** Borra un operador del tenant. */
export async function borrarOperador(formData: FormData) {
  const slug = slugDeForm(formData);
  await requireAdmin(slug);
  const supabase = await createClient();
  const id = String(formData.get("id"));
  await supabase.from("usuarios").delete().eq("id", id);
  revalidatePath(`/${slug}/admin`);
}

/** Reasigna el candidato (equipo) de un operador Mesa Guía o KP. "" = sin candidato. */
export async function asignarCandidato(formData: FormData) {
  const slug = slugDeForm(formData);
  await requireAdmin(slug);
  const supabase = await createClient();

  const id = String(formData.get("id"));
  const candidatoId = String(formData.get("candidato_id") ?? "") || null;

  await supabase.from("usuarios").update({ candidato_id: candidatoId }).eq("id", id);
  revalidatePath(`/${slug}/admin`);
}

/** Alterna el estado Activo/Bloqueado de un operador. */
export async function alternarBloqueo(formData: FormData) {
  const slug = slugDeForm(formData);
  await requireAdmin(slug);
  const supabase = await createClient();

  const id = String(formData.get("id"));
  const estadoActual = String(formData.get("estado"));
  const nuevo = estadoActual === "Bloqueado" ? "Activo" : "Bloqueado";

  await supabase.from("usuarios").update({ estado: nuevo }).eq("id", id);
  revalidatePath(`/${slug}/admin`);
}

/** Habilita/deshabilita cada canal del tenant (pueden estar ambos activos). */
export async function guardarCanales(formData: FormData) {
  const slug = slugDeForm(formData);
  const { email } = await requireAdmin(slug);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const tenantId = (user?.app_metadata as { tenant_id?: string })?.tenant_id;
  if (!tenantId) return;

  const telegram = formData.get("telegram") === "on";
  const pwa = formData.get("pwa") === "on";

  await supabase
    .from("configuracion_operativa")
    .update({
      telegram_activo: telegram,
      pwa_activo: pwa,
      actualizado_por: email,
      actualizado_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);
  revalidatePath(`/${slug}/admin`);
}

/** Enciende/apaga el sistema completo (interruptor maestro). OFF = nadie opera. */
export async function guardarSistemaActivo(formData: FormData) {
  const slug = slugDeForm(formData);
  const { email } = await requireAdmin(slug);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const tenantId = (user?.app_metadata as { tenant_id?: string })?.tenant_id;
  if (!tenantId) return;

  const activo = formData.get("sistema_activo") === "on";
  await supabase
    .from("configuracion_operativa")
    .update({
      sistema_activo: activo,
      actualizado_por: email,
      actualizado_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);
  revalidatePath(`/${slug}/admin`);
}

/** tenant_id del admin autenticado (desde app_metadata del JWT). */
async function tenantIdActual(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (user?.app_metadata as { tenant_id?: string })?.tenant_id ?? null;
}

/** Crea un candidato (Intendente o Concejal) en el tenant del admin. */
export async function crearCandidato(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const slug = slugDeForm(formData);
  await requireAdmin(slug);
  const supabase = await createClient();

  const tipo = String(formData.get("tipo"));
  const nombre = String(formData.get("nombre") ?? "").trim();
  const lista = String(formData.get("lista") ?? "").trim() || null;
  const opcion = formData.get("opcion") ? Number(formData.get("opcion")) : null;

  if (!nombre) return { ok: false, message: "El nombre es obligatorio." };
  if (tipo !== "Intendente" && tipo !== "Concejal")
    return { ok: false, message: "Tipo inválido." };

  const tenantId = await tenantIdActual();
  if (!tenantId) return { ok: false, message: "Sesión inválida." };

  const { error } = await supabase.from("candidatos").insert({
    tenant_id: tenantId,
    tipo,
    nombre,
    lista,
    opcion,
  });
  if (error) return { ok: false, message: "No se pudo crear el candidato." };

  revalidatePath(`/${slug}/admin/candidatos`);
  return { ok: true, message: `${nombre} agregado.` };
}

/** Edita los datos de un candidato. */
export async function editarCandidato(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const slug = slugDeForm(formData);
  await requireAdmin(slug);
  const supabase = await createClient();

  const id = String(formData.get("id"));
  const tipo = String(formData.get("tipo"));
  const nombre = String(formData.get("nombre") ?? "").trim();
  const lista = String(formData.get("lista") ?? "").trim() || null;
  const opcion = formData.get("opcion") ? Number(formData.get("opcion")) : null;

  if (!nombre) return { ok: false, message: "El nombre es obligatorio." };
  if (tipo !== "Intendente" && tipo !== "Concejal")
    return { ok: false, message: "Tipo inválido." };

  const { error } = await supabase
    .from("candidatos")
    .update({ tipo, nombre, lista, opcion })
    .eq("id", id);
  if (error) return { ok: false, message: "No se pudo actualizar." };

  revalidatePath(`/${slug}/admin/candidatos`);
  return { ok: true, message: "Candidato actualizado." };
}

/** Borra un candidato. Los operadores vinculados quedan sin candidato (SET NULL). */
export async function borrarCandidato(formData: FormData) {
  const slug = slugDeForm(formData);
  await requireAdmin(slug);
  const supabase = await createClient();

  const id = String(formData.get("id"));
  await supabase.from("candidatos").delete().eq("id", id);
  revalidatePath(`/${slug}/admin/candidatos`);
}

/** Resetea la jornada activa: borra participaciones, alertas y eventos. */
export async function resetearJornada(_prev: FormState, formData: FormData): Promise<FormState> {
  const slug = slugDeForm(formData);
  const { tenant } = await requireAdmin(slug);
  // El usuario debe confirmar escribiendo el nombre del tenant.
  const confirma = String(formData.get("confirmacion") ?? "").trim();
  if (confirma !== tenant.nombre) {
    return { ok: false, message: "Confirmación incorrecta. No se borró nada." };
  }

  const db = createAdminClient();
  const jornada = await getJornadaActiva(db, tenant.id);
  if (!jornada) return { ok: false, message: "No hay una jornada activa." };

  const { error } = await db.rpc("resetear_jornada", { p_jornada: jornada.id });
  if (error) return { ok: false, message: "No se pudo resetear la jornada." };

  revalidatePath(`/${slug}/admin`);
  return { ok: true, message: "Jornada reseteada: participaciones, alertas y eventos borrados." };
}

/** Genera el link único de la PWA para un operador del tenant. */
export async function generarLinkPWA(slug: string, usuarioId: string): Promise<string> {
  await requireAdmin(slug);
  const h = await headers();
  const host = h.get("host") ?? "";
  const proto = host.includes("localhost") ? "http" : "https";
  const token = firmarTokenOperador(usuarioId);
  return `${proto}://${host}/${slug}/pwa?t=${token}`;
}
