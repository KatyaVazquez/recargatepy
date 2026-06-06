/** Formateo de fechas/horas en zona horaria de Paraguay (America/Asuncion). */

const TZ = "America/Asuncion";

/** "10:22" — hora y minutos de un timestamp ISO. */
export function horaAsuncion(iso: string): string {
  return new Intl.DateTimeFormat("es-PY", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** "2 min 14 seg" a partir de segundos. */
export function duracionLegible(segundos: number): string {
  const s = Math.floor(segundos);
  const min = Math.floor(s / 60);
  const seg = s % 60;
  if (min === 0) return `${seg} seg`;
  return `${min} min ${seg} seg`;
}
