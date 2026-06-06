/**
 * Normalización de teléfonos para cruzar el contacto compartido en Telegram
 * con la whitelist cargada por el admin.
 *
 * Telegram puede mandar el número como "595981123456", "+595981123456", etc.
 * El admin puede cargar "0981123456", "981123456", "+595 981 123456"...
 * Comparamos por los últimos 8-9 dígitos significativos (número local Paraguay).
 */

const CODIGO_PAIS = "595";

/** Devuelve los dígitos significativos del número (sin país ni 0 inicial). */
export function digitosTelefono(input: string): string {
  let d = (input ?? "").replace(/\D/g, "");
  // Quita código de país Paraguay si está
  if (d.startsWith(CODIGO_PAIS)) d = d.slice(CODIGO_PAIS.length);
  // Quita 0 inicial de marcación nacional
  if (d.startsWith("0")) d = d.slice(1);
  return d;
}

/** True si dos teléfonos refieren al mismo número (tolerante a prefijos). */
export function mismoTelefono(a: string, b: string): boolean {
  const da = digitosTelefono(a);
  const db = digitosTelefono(b);
  if (!da || !db) return false;
  return da === db;
}
