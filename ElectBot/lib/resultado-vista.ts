/**
 * Convierte el resultado estructurado del orquestador en una "vista" lista para
 * renderizar (tono + título + líneas). Lo usa la PWA. Mismo contenido que los
 * mensajes del bot, pero en datos en vez de texto con HTML.
 */
import type { ResultadoMensaje } from "@/lib/orquestador";
import type { Elector } from "@/lib/types";
import { duracionLegible, horaAsuncion } from "@/lib/fecha";

export type Tono = "ok" | "info" | "warn" | "danger";
export type Vista = { tono: Tono; titulo: string; lineas: string[]; nota?: string };

function ubic(e: Elector, ci?: string): string[] {
  return [
    ...(ci ? [`CI: ${ci}`] : []),
    `${e.apellido}, ${e.nombre}`,
    `Local: ${e.nombre_local ?? "-"}`,
    `Mesa ${e.mesa} · Orden ${e.orden}`,
  ];
}

export function resultadoAVista(res: ResultadoMensaje): Vista {
  if (res.clase === "ci_invalido") {
    return { tono: "danger", titulo: "Formato de CI inválido", lineas: ["Ingresá solo el número de cédula."] };
  }
  if (res.clase === "sistema_apagado") {
    return {
      tono: "warn",
      titulo: "Sistema apagado",
      lineas: ["El administrador desactivó el sistema. No se aceptan operaciones por ahora."],
    };
  }
  if (res.clase === "canal_inactivo") {
    return {
      tono: "warn",
      titulo: "Canal no activo",
      lineas: [`Las operaciones por ${res.canal} están deshabilitadas en este momento.`],
    };
  }
  if (res.clase === "orden_error") {
    const lineas: Record<typeof res.motivo, string> = {
      sin_mesa: "Tu mesa no está configurada. Pedí al admin que la asigne o usá la cédula.",
      no_existe: "No hay un elector con ese número de orden en tu mesa.",
      ambiguo: "Ese número de orden coincide con más de una mesa. Usá la cédula.",
      fuera_jornada: "Ese elector no participa en esta jornada.",
    };
    return { tono: "warn", titulo: "Orden no válido", lineas: [lineas[res.motivo]] };
  }
  if (res.clase === "saludo") {
    const r = res.r;
    if (r.tipo === "no_encontrado")
      return { tono: "danger", titulo: "CI no encontrado", lineas: [`El número ${r.ci} no figura en el padrón.`] };
    if (r.tipo === "otro_municipio")
      return { tono: "warn", titulo: "Otro municipio", lineas: [`${r.elector.apellido}, ${r.elector.nombre}`] };
    if (r.tipo === "fuera_jornada")
      return { tono: "warn", titulo: "Fuera de esta jornada", lineas: [`${r.elector.apellido}, ${r.elector.nombre}`] };
    if (r.tipo === "ya_saludado") {
      const lineas = ubic(r.elector, r.elector.ci_normalizado);
      lineas.push(`Ya saludado por ${r.kpNombre ?? "otro KP"} a las ${horaAsuncion(r.saludoAt)}.`);
      if (r.votoAt) lineas.push(`Votó a las ${horaAsuncion(r.votoAt)}.`);
      return { tono: "warn", titulo: "Ya fue saludado", lineas };
    }
    // saludado
    return {
      tono: "ok",
      titulo: "Saludo registrado",
      lineas: ubic(r.elector, r.elector.ci_normalizado),
      nota: r.yaVoto && r.votoAt ? `Ya votó (${horaAsuncion(r.votoAt)}).` : "Todavía no votó.",
    };
  }

  if (res.clase === "consulta") {
    const r = res.r;
    if (r.tipo === "no_encontrado")
      return { tono: "danger", titulo: "CI no encontrado", lineas: [`El número ${r.ci} no figura en el padrón.`] };
    if (r.tipo === "otro_municipio")
      return { tono: "warn", titulo: "Otro municipio", lineas: [`${r.elector.apellido}, ${r.elector.nombre}`, `Corresponde a ${r.elector.nombre_distrito ?? "-"}`] };
    if (r.tipo === "fuera_jornada")
      return { tono: "warn", titulo: "Fuera de esta jornada", lineas: [`${r.elector.apellido}, ${r.elector.nombre}`] };
    // ok
    const ci = r.elector.ci_normalizado;
    if (r.alerta === "Roja")
      return {
        tono: "danger",
        titulo: "ALERTA ROJA — Ya votó",
        lineas: ubic(r.elector, ci),
        nota: r.votoInfo?.hora ? `Hora de voto: ${horaAsuncion(r.votoInfo.hora)}.` : undefined,
      };
    if (r.alerta === "Amarilla")
      return { tono: "warn", titulo: "Alerta amarilla", lineas: ubic(r.elector, ci), nota: "Ya consultó con tu mismo equipo." };
    if (r.alerta === "Naranja")
      return { tono: "warn", titulo: "Alerta naranja", lineas: ubic(r.elector, ci), nota: "Ya consultó con otro equipo." };
    return { tono: "ok", titulo: "No votó aún", lineas: ubic(r.elector, ci) };
  }

  if (res.clase === "voto") {
    const r = res.r;
    if (r.tipo === "no_encontrado")
      return { tono: "danger", titulo: "CI no encontrado", lineas: [`El número ${r.ci} no figura en el padrón.`] };
    if (r.tipo === "otro_municipio")
      return { tono: "warn", titulo: "Otro municipio", lineas: [`${r.elector.apellido}, ${r.elector.nombre}`] };
    if (r.tipo === "fuera_jornada")
      return { tono: "warn", titulo: "Fuera de esta jornada", lineas: [`${r.elector.apellido}, ${r.elector.nombre}`] };
    if (r.tipo === "ya_voto")
      return { tono: "warn", titulo: "Ya estaba votado", lineas: [`${r.elector.apellido}, ${r.elector.nombre}`] };
    if (r.tipo === "mesa_incorrecta")
      return {
        tono: "danger",
        titulo: "Mesa incorrecta — voto no registrado",
        lineas: [`${r.elector.apellido}, ${r.elector.nombre}`, `Este elector pertenece a la mesa ${r.elector.mesa}, no a la tuya.`],
        nota: "El admin fue notificado. No podés registrar este voto.",
      };
    // ok
    return {
      tono: "ok",
      titulo: `Voto registrado · CI ${r.elector.ci_normalizado}`,
      lineas: [`${r.elector.apellido}, ${r.elector.nombre}`, `Mesa ${r.elector.mesa} · Orden ${r.elector.orden}`],
    };
  }

  if (res.clase === "correccion_admin") {
    const r = res.r;
    if (r.tipo === "no_encontrado") return { tono: "danger", titulo: "CI no encontrado", lineas: [`El número ${r.ci} no figura en el padrón.`] };
    if (r.tipo === "no_voto") return { tono: "info", titulo: "Nada que corregir", lineas: ["Ese CI no figura como votado."] };
    return {
      tono: "info",
      titulo: "Solicitud enviada al admin",
      lineas: [`${r.elector.apellido}, ${r.elector.nombre}`],
      nota: "El admin verá tu pedido en el panel y resolverá la corrección.",
    };
  }

  // correccion
  const r = res.r;
  if (r.tipo === "no_encontrado") return { tono: "danger", titulo: "CI no encontrado", lineas: [`El número ${r.ci} no figura en el padrón.`] };
  if (r.tipo === "no_voto") return { tono: "info", titulo: "Nada que corregir", lineas: ["Ese CI no figura como votado."] };
  if (r.tipo === "ventana_expirada")
    return { tono: "danger", titulo: "No autorizado", lineas: [`La ventana de corrección expiró.`, `Voto cargado: ${horaAsuncion(r.votoAt)}`], nota: "Solicitá al admin con CORREGIR_ADMIN <ci>." };
  return { tono: "ok", titulo: "Corrección registrada", lineas: ["El voto fue revertido. Estado: Pendiente.", `Tiempo: ${duracionLegible(r.segundos)}`] };
}
