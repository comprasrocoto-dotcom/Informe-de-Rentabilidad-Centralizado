"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/Contexto";
import { agrupar, type FilaCosto } from "./rentabilidad";

const mesesAtras = (iso: string, n: number) => {
  const [y, m] = iso.slice(0, 7).split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - n, 1));
  return d.toISOString().slice(0, 10);
};

/** Trae el motor de costos para los filtros activos y lo agrupa por mes y sede.
 *  `mesesAntes` trae meses extra antes de "Desde" (sirven de referencia para comparar el primer mes). */
export function useCostos(mesesAntes = 0) {
  const { sb, filtros, sedes } = useApp();
  const [filas, setFilas] = useState<FilaCosto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const desde = filtros.desde && mesesAntes ? mesesAtras(filtros.desde, mesesAntes) : filtros.desde || null;
    sb.rpc("resumen_costos", { p_marca: filtros.marcaId, p_desde: desde, p_hasta: filtros.hasta || null })
      .then(({ data, error }) => {
        if (!vivo) return;
        setError(error?.message ?? null);
        setFilas((data as FilaCosto[]) ?? []);
        setCargando(false);
      });
    return () => { vivo = false; };
  }, [sb, filtros.marcaId, filtros.desde, filtros.hasta, mesesAntes]);

  const sedePorId = useMemo(() => new Map(sedes.map((s) => [s.id, s])), [sedes]);
  const grupos = useMemo(
    () => agrupar(filas, (id) => sedePorId.get(id)?.tipo === "produccion", filtros.sedeId),
    [filas, sedePorId, filtros.sedeId],
  );
  return { filas, cargando, error, ...grupos, sedePorId };
}
