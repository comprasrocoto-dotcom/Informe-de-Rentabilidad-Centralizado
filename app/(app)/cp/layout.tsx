"use client";

import { useApp } from "@/components/Contexto";
import { ProveedorCP } from "@/components/cp/ContextoCP";

export default function LayoutCP({ children }: { children: React.ReactNode }) {
  const { perfil } = useApp();
  if (perfil.rol !== "admin") {
    return <p className="text-sm text-texto-2">El Centro de producción solo está disponible para el administrador.</p>;
  }
  return <ProveedorCP>{children}</ProveedorCP>;
}
