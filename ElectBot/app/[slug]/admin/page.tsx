import { Users, ShieldCheck, Radio, UserCog, ArrowLeftRight, Handshake, Power } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { alternarBloqueo, alternarRol, guardarCanales, guardarSistemaActivo } from "./actions";
import { OperadorForm } from "./operador-form";
import { EditarOperadorButton } from "./editar-operador-button";
import { ResetearJornada } from "./resetear-jornada";
import { BorrarOperadorButton } from "./borrar-operador-button";
import { LinkPwaButton } from "./link-pwa-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type UsuarioRow = {
  id: string;
  nombre: string | null;
  telefono: string;
  rol: "Mesa_Guia" | "Veedor" | "KP";
  mesa: number | null;
  puesto: number | null;
  candidato_id: string | null;
  estado: "Activo" | "Bloqueado";
  telegram_id: number | null;
};

type CandidatoOpcion = {
  id: string;
  nombre: string;
  lista: string | null;
  opcion: number | null;
};

function StatCard({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: typeof Users;
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

export default async function OperadoresPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { tenant } = await requireAdmin(slug);
  const supabase = await createClient();

  const { data } = await supabase
    .from("usuarios")
    .select("id, nombre, telefono, rol, mesa, puesto, candidato_id, estado, telegram_id")
    .order("nombre");
  const usuarios = (data ?? []) as UsuarioRow[];

  // Concejales: cada Mesa Guía pertenece a uno (su equipo).
  const { data: candData } = await supabase
    .from("candidatos")
    .select("id, nombre, lista, opcion")
    .eq("tipo", "Concejal")
    .order("nombre");
  const candidatos = (candData ?? []) as CandidatoOpcion[];

  const { data: cfg } = await supabase
    .from("configuracion_operativa")
    .select("telegram_activo, pwa_activo, sistema_activo")
    .maybeSingle();
  const telegramActivo = cfg?.telegram_activo ?? true;
  const pwaActivo = cfg?.pwa_activo ?? true;
  const sistemaActivo = cfg?.sistema_activo ?? true;

  const total = usuarios.length;
  const guias = usuarios.filter((u) => u.rol === "Mesa_Guia").length;
  const veedores = usuarios.filter((u) => u.rol === "Veedor").length;
  const kps = usuarios.filter((u) => u.rol === "KP").length;
  const vinculados = usuarios.filter((u) => u.telegram_id).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Operadores</h1>
        <p className="text-sm text-muted-foreground">
          Cargá a tu equipo de campo. Al hacer /start y compartir su número, quedan habilitados.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={Users} label="Total" value={total} tint="bg-muted text-foreground" />
        <StatCard icon={UserCog} label="Mesa Guía" value={guias} tint="bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400" />
        <StatCard icon={ShieldCheck} label="Veedores" value={veedores} tint="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400" />
        <StatCard icon={Handshake} label="KP" value={kps} tint="bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400" />
        <StatCard icon={Radio} label="Vinculados" value={vinculados} tint="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400" />
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Estado del sistema</CardTitle>
          <CardDescription>
            Interruptor maestro: con el sistema apagado, nadie puede operar
            (ni Telegram ni PWA), aunque los canales estén habilitados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  sistemaActivo
                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
                    : "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400"
                }`}
              >
                <Power className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Sistema {sistemaActivo ? "ENCENDIDO" : "APAGADO"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sistemaActivo
                    ? "Las operaciones se están aceptando normalmente."
                    : "Las operaciones están bloqueadas para todos los roles."}
                </p>
              </div>
            </div>
            <form action={guardarSistemaActivo}>
              <input type="hidden" name="slug" value={slug} />
              {/* Enviar el estado OPUESTO al actual para alternar. */}
              <input type="hidden" name="sistema_activo" value={sistemaActivo ? "off" : "on"} />
              <Button type="submit" variant={sistemaActivo ? "outline" : "default"} size="sm">
                {sistemaActivo ? "Apagar sistema" : "Encender sistema"}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Canales habilitados</CardTitle>
          <CardDescription>
            Marcá por dónde se aceptan operaciones. Pueden estar ambos activos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={guardarCanales} className="flex flex-wrap items-center gap-6">
            <input type="hidden" name="slug" value={slug} />
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                name="telegram"
                defaultChecked={telegramActivo}
                className="h-4 w-4 accent-red-600"
              />
              Telegram
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                name="pwa"
                defaultChecked={pwaActivo}
                className="h-4 w-4 accent-amber-600"
              />
              PWA (contingencia)
            </label>
            <Button type="submit" variant="outline" size="sm">
              Guardar
            </Button>
          </form>
          <div className="mt-6 flex items-center justify-between border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Limpiar datos de prueba antes del día real (no borra operadores ni candidatos).
            </p>
            <ResetearJornada slug={slug} tenantNombre={tenant.nombre} />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Nuevo operador</CardTitle>
          <CardDescription>
            Solo el teléfono es obligatorio. Mesa/puesto mejora la precisión de las alertas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OperadorForm slug={slug} candidatos={candidatos} />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Lista de operadores</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Nombre</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Mesa/Puesto</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="pr-6 text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Sin operadores todavía. Agregá el primero arriba.
                  </TableCell>
                </TableRow>
              )}
              {usuarios.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="pl-6 font-medium text-foreground">
                    {u.nombre ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.telefono}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        u.rol === "Mesa_Guia"
                          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
                          : u.rol === "KP"
                            ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
                      }
                    >
                      {u.rol === "Mesa_Guia" ? "Mesa Guía" : u.rol === "KP" ? "KP" : "Veedor"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.rol === "Mesa_Guia"
                      ? u.puesto
                        ? `Puesto ${u.puesto}`
                        : "—"
                      : u.mesa
                        ? `Mesa ${u.mesa}`
                        : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.rol === "Mesa_Guia" || u.rol === "KP"
                      ? (candidatos.find((c) => c.id === u.candidato_id)?.nombre ?? "—")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-2 w-2 rounded-full ${
                          u.estado === "Activo" ? "bg-emerald-500" : "bg-red-500"
                        }`}
                      />
                      <span className="text-sm text-foreground">{u.estado}</span>
                      {!u.telegram_id && (
                        <Badge variant="secondary" className="text-[10px]">
                          sin vincular
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <EditarOperadorButton slug={slug} operador={u} candidatos={candidatos} />
                      <LinkPwaButton slug={slug} usuarioId={u.id} />
                      <form action={alternarRol} className="inline">
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="rol" value={u.rol} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          title={`Cambiar a ${u.rol === "Veedor" ? "Mesa Guía" : "Veedor"}`}
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                        </Button>
                      </form>
                      <form action={alternarBloqueo} className="inline">
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="estado" value={u.estado} />
                        <Button type="submit" variant="outline" size="sm">
                          {u.estado === "Bloqueado" ? "Activar" : "Bloquear"}
                        </Button>
                      </form>
                      <BorrarOperadorButton slug={slug} id={u.id} nombre={u.nombre ?? u.telefono} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
