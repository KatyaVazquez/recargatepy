/**
 * Normalización de cédula de identidad (CI).
 *
 * Reglas (spec sección 6.1):
 * - Quita puntos, espacios, guiones y cualquier caracter no numérico.
 * - Rechaza si el resultado tiene menos de 5 o más de 9 dígitos.
 */

export type ResultadoCI =
  | { ok: true; ci: string }
  | { ok: false; motivo: "vacio" | "longitud" };

/** Normaliza un CI crudo. Devuelve el CI limpio o el motivo del rechazo. */
export function normalizarCI(input: string): ResultadoCI {
  const soloDigitos = (input ?? "").replace(/\D/g, "");

  if (soloDigitos.length === 0) {
    return { ok: false, motivo: "vacio" };
  }
  if (soloDigitos.length < 5 || soloDigitos.length > 9) {
    return { ok: false, motivo: "longitud" };
  }
  return { ok: true, ci: soloDigitos };
}

/** Mensaje al operador según el motivo de rechazo. */
export function mensajeCIInvalido(motivo: "vacio" | "longitud"): string {
  return "Formato de CI invalido";
}
