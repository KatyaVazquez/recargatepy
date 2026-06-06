"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { borrarOperador } from "./actions";
import { Button } from "@/components/ui/button";

export function BorrarOperadorButton({
  slug,
  id,
  nombre,
}: {
  slug: string;
  id: string;
  nombre: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`¿Borrar a ${nombre}? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append("slug", slug);
      fd.append("id", id);
      await borrarOperador(fd);
      toast.success(`${nombre} borrado.`);
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      title="Borrar operador"
      disabled={pending}
      onClick={handleClick}
      className="text-red-600 hover:text-red-700"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
