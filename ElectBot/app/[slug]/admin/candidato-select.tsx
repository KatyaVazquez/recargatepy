"use client";

import { useRef } from "react";
import { asignarCandidato } from "./actions";

type Opcion = { id: string; nombre: string; lista: string | null };

/** Selector inline que reasigna el candidato de un operador al cambiar. */
export function CandidatoSelect({
  slug,
  usuarioId,
  value,
  candidatos,
}: {
  slug: string;
  usuarioId: string;
  value: string | null;
  candidatos: Opcion[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form action={asignarCandidato} ref={formRef}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="id" value={usuarioId} />
      <select
        key={value ?? ""}
        name="candidato_id"
        defaultValue={value ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-8 max-w-[11rem] rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
      >
        <option value="">— Sin asignar —</option>
        {candidatos.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
            {c.lista ? ` (${c.lista})` : ""}
          </option>
        ))}
      </select>
    </form>
  );
}
