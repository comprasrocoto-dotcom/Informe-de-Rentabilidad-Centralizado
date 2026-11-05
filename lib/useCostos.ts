"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/Contexto";
import { agrupar, type FilaCosto } from "./rentabilidad";

/** Trae el motor de costos para los filtros activos y lo agrupa por mes y sede. */
export function useCostos() {
  const { sb, filtros, sedes } = useApp();
  const [filas, setFilas] = useState<FilaCosto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    sb.rpc("resumen_costos", { p_marca: filtros.marcaId, p_desde: filtros.desde || null, p_hasta: filtros.hasta || null })
      .then(({ data, error }) => {
        if (!vivo) return;
        setError(error?.message ?? null);
        setFilas((data as FilaCosto[]) ?? []);
        setCargando(false);
      });
    return () => { vivo = false; };
  }, [sb, filtros.marcaId, filtros.desde, filtros.hasta]);

  const sedePorId = useMemo(() => new Map(sedes.map((s) => [s.id, s])), [sedes]);
  const grupos = useMemo(
    () => agrupar(filas, (id) => sedePorId.get(id)?.tipo === "produccion", filtros.sedeId),
    [filas, sedePorId, filtros.sedeId],
  );
  return { filas, cargando, error, ...grupos, sedePorId };
}
