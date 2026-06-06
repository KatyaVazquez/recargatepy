import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { horaAsuncion } from "@/lib/fecha";

type AlertaRow = {
  id: string;
  ci_normalizado: string | null;
  jornada_id: string | null;
  severidad: "Amarilla" | "Naranja" | "Roja" | "Critica";
  descripcion: string | null;
  resuelta: boolean;
  timestamp: string;
  usuario_id: string | null;
};

const SEVERIDAD: Record<AlertaRow["severidad"], { dot: string; label: string }> = {
  Amarilla: { dot: "bg-yellow-400", label: "Amarilla" },
  Naranja: { dot: "bg-orange-500", label: "Naranja" },
  Roja: { dot: "bg-red-600", label: "Roja" },
  Critica: { dot: "bg-red-900", label: "Crítica" },
};

/** "1ª", "2ª", … a partir del número de consulta. */
function ordinal(n: number): string {
  return `${n}ª`;
}

export default async function AlertasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireAdmin(slug);
  const supabase = await createClient();

  const { data } = await supabase
    .from("alertas")
    .select("id, ci_normalizado, jornada_id, severidad, descripcion, resuelta, timestamp, usuario_id")
    .order("timestamp", { ascending: false })
    .limit(100);
  const alertas = (data ?? []) as AlertaRow[];

  // ─── Enriquecer en lote: nombre del elector, equipo/mesa y nº de consulta ──
  const cis = [...new Set(alertas.map((a) => a.ci_normalizado).filter(Boolean))] as string[];
  const jornadaIds = [...new Set(alertas.map((a) => a.jornada_id).filter(Boolean))] as string[];
  const usuarioIds = [...new Set(alertas.map((a) => a.usuario_id).filter(Boolean))] as string[];

  const electorMap = new Map<string, { nombre: string; apellido: string }>();
  const partMap = new Map<string, { puesto: string | null; candidato_id: string | null }>();
  const candMap = new Map<string, { nombre: string; lista: string | null; opcion: number | null }>();
  const consultas = new Map<string, number>();
  const operadorMap = new Map<string, string>();

  // Fila 79: operador que generó cada alerta.
  if (usuarioIds.length > 0) {
    const { data: us } = await supabase
      .from("usuarios")
      .select("id, nombre, telefono")
      .in("id", usuarioIds);
    (us ?? []).forEach((u) =>
      operadorMap.set(u.id, u.nombre || u.telefono || "—")
    );
  }

  if (cis.length > 0) {
    const { data: el } = await supabase
      .from("electores")
      .select("ci_normalizado, nombre, apellido")
      .in("ci_normalizado", cis);
    (el ?? []).forEach((e) =>
      electorMap.set(e.ci_normalizado, { nombre: e.nombre, apellido: e.apellido })
    );

    if (jornadaIds.length > 0) {
      const { data: ps } = await supabase
        .from("participaciones")
        .select("ci_normalizado, ultima_consulta_puesto, ultima_consulta_candidato_id, veces_consultado")
        .in("ci_normalizado", cis)
        .in("jornada_id", jornadaIds);
      (ps ?? []).forEach((p) => {
        partMap.set(p.ci_normalizado, {
          puesto: p.ultima_consulta_puesto,
          candidato_id: p.ultima_consulta_candidato_id,
        });
        // Fila 77: total acumulado de consultas, no solo la última.
        consultas.set(p.ci_normalizado, p.veces_consultado ?? 0);
      });

      const candIds = [
        ...new Set([...partMap.values()].map((p) => p.candidato_id).filter(Boolean)),
      ] as string[];
      if (candIds.length > 0) {
        const { data: cs } = await supabase
          .from("candidatos")
          .select("id, nombre, lista, opcion")
          .in("id", candIds);
        (cs ?? []).forEach((c) =>
          candMap.set(c.id, { nombre: c.nombre, lista: c.lista, opcion: c.opcion })
        );
      }

    }
  }

  function equipoLabel(ci: string | null): string {
    if (!ci) return "—";
    const part = partMap.get(ci);
    if (part?.candidato_id) {
      const c = candMap.get(part.candidato_id);
      if (c) return `${c.nombre}${c.lista ? ` · ${c.lista}${c.opcion ? `·${c.opcion}` : ""}` : ""}`;
    }
    return part?.puesto ?? "—";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Alertas</h1>
        <p className="text-sm text-muted-foreground">
          Eventos sospechosos detectados durante la operación, más recientes primero.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-muted-foreground" />
            Últimas alertas ({alertas.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Hora</TableHead>
                <TableHead>Severidad</TableHead>
                <TableHead>Elector</TableHead>
                <TableHead>CI</TableHead>
                <TableHead>Consulta</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>Equipo / Mesa</TableHead>
                <TableHead className="pr-6">Descripción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alertas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    Sin alertas registradas.
                  </TableCell>
                </TableRow>
              )}
              {alertas.map((a) => {
                const s = SEVERIDAD[a.severidad];
                const el = a.ci_normalizado ? electorMap.get(a.ci_normalizado) : null;
                const nConsultas = a.ci_normalizado ? consultas.get(a.ci_normalizado) ?? 0 : 0;
                return (
                  <TableRow key={a.id}>
                    <TableCell className="pl-6 font-mono text-sm text-muted-foreground">
                      {horaAsuncion(a.timestamp)}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
                        <span className="text-sm font-medium text-foreground">{s.label}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {el ? `${el.apellido}, ${el.nombre}` : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {a.ci_normalizado ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {nConsultas > 0 ? `${ordinal(nConsultas)} consulta` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.usuario_id ? operadorMap.get(a.usuario_id) ?? "—" : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {equipoLabel(a.ci_normalizado)}
                    </TableCell>
                    <TableCell className="pr-6 text-sm text-muted-foreground">
                      {a.descripcion ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
