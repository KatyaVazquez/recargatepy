"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generarLinkPWA } from "./actions";

export function LinkPwaButton({ slug, usuarioId }: { slug: string; usuarioId: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      const url = await generarLinkPWA(slug, usuarioId);
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      toast.success("Link PWA copiado");
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("No se pudo generar el link");
    }
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={copiar} title="Copiar link de la PWA">
      {copiado ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
    </Button>
  );
}
