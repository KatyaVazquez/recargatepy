"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Trash2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { editarCandidato, borrarCandidato, type FormState } from "../actions";
import type { Candidato } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function TipoBadge({ tipo }: { tipo: Candidato["tipo"] }) {
  return (
    <Badge
      variant="outline"
      className={
        tipo === "Intendente"
          ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300"
          : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
      }
    >
      {tipo}
    </Badge>
  );
}

function EditRow({
  slug,
  c,
  onDone,
}: {
  slug: string;
  c: Candidato;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(editarCandidato, null);
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      onDone();
    } else if (state && !state.ok) {
      toast.error(state.message);
    }
  }, [state, onDone]);

  return (
    <TableRow>
      <TableCell colSpan={4} className="px-6 py-3">
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="id" value={c.id} />
          <select
            name="tipo"
            defaultValue={c.tipo}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
          >
            <option value="Concejal">Concejal</option>
            <option value="Intendente">Intendente</option>
          </select>
          <Input name="nombre" defaultValue={c.nombre} className="w-44" required />
          <Input name="lista" defaultValue={c.lista ?? ""} placeholder="Lista" className="w-24" />
          <Input
            name="opcion"
            type="number"
            defaultValue={c.opcion ?? ""}
            placeholder="Opción"
            className="w-24"
          />
          <Button type="submit" size="sm">
            <Check className="h-4 w-4" /> Guardar
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            <X className="h-4 w-4" /> Cancelar
          </Button>
        </form>
      </TableCell>
    </TableRow>
  );
}

export function CandidatosList({
  slug,
  candidatos,
}: {
  slug: string;
  candidatos: Candidato[];
}) {
  const [editando, setEditando] = useState<string | null>(null);

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-6">Tipo</TableHead>
          <TableHead>Nombre</TableHead>
          <TableHead>Lista / Opción</TableHead>
          <TableHead className="pr-6 text-right">Acción</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {candidatos.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
              Sin candidatos todavía. Agregá el primero arriba.
            </TableCell>
          </TableRow>
        )}
        {candidatos.map((c) =>
          editando === c.id ? (
            <EditRow key={c.id} slug={slug} c={c} onDone={() => setEditando(null)} />
          ) : (
            <TableRow key={c.id}>
              <TableCell className="pl-6">
                <TipoBadge tipo={c.tipo} />
              </TableCell>
              <TableCell className="font-medium text-foreground">{c.nombre}</TableCell>
              <TableCell className="text-muted-foreground">
                {c.lista || c.opcion
                  ? `${c.lista ?? "—"}${c.opcion ? ` · Opción ${c.opcion}` : ""}`
                  : "—"}
              </TableCell>
              <TableCell className="pr-6 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    title="Editar"
                    onClick={() => setEditando(c.id)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <form action={borrarCandidato} className="inline">
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="id" value={c.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      title="Borrar"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </TableCell>
            </TableRow>
          )
        )}
      </TableBody>
    </Table>
  );
}
