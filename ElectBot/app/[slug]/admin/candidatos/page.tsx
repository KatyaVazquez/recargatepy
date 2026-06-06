import { Award, UserCog, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { Candidato } from "@/lib/types";
import { CandidatoForm } from "./candidato-form";
import { CandidatosList } from "./candidatos-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function StatCard({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: typeof Award;
  label: string;
  value: number;
  tint: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-center gap-4 py-5">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold leading-none text-foreground">{value}</p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function CandidatosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireAdmin(slug);
  const supabase = await createClient();

  const { data } = await supabase
    .from("candidatos")
    .select("id, tenant_id, tipo, nombre, lista, opcion, orden")
    .order("tipo")
    .order("orden")
    .order("nombre");
  const candidatos = (data ?? []) as Candidato[];

  const intendentes = candidatos.filter((c) => c.tipo === "Intendente").length;
  const concejales = candidatos.filter((c) => c.tipo === "Concejal").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Candidatos</h1>
        <p className="text-sm text-muted-foreground">
          Cargá tu lista: el Intendente y los Concejales. A cada operador de Mesa Guía le
          asignás su Concejal (su equipo) desde la sección Operadores.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard icon={Award} label="Total" value={candidatos.length} tint="bg-muted text-foreground" />
        <StatCard icon={ShieldCheck} label="Intendente" value={intendentes} tint="bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400" />
        <StatCard icon={UserCog} label="Concejales" value={concejales} tint="bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400" />
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Nuevo candidato</CardTitle>
          <CardDescription>
            Solo el nombre es obligatorio. Lista y opción ayudan a identificar el equipo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CandidatoForm slug={slug} />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Lista de candidatos</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <CandidatosList slug={slug} candidatos={candidatos} />
        </CardContent>
      </Card>
    </div>
  );
}
