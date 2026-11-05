"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/Contexto";
import { traerTodo } from "@/lib/cp/subidaCP";
import { crearConversor, type DatosCP, type Filtro } from "@/lib/cp/motorCP";

type Ctx = {
  datos: DatosCP;
  cargando: boolean;
  error: string | null;
  filtro: Filtro;
  setFiltro: (f: Partial<Filtro>) => void;
  meses: string[];
  conv: ReturnType<typeof crearConversor>;
  recargar: () => Promise<void>;
};
const C = createContext<Ctx | null>(null);
export const useCP = () => {
  const c = useContext(C);
  if (!c) throw new Error("useCP fuera del proveedor");
  return c;
};

const vacio: DatosCP = { compras: [], fab: [], tras: [], inv: [], conv: [], costos: [], manual: [] };
const conMes = <T extends { fecha: string }>(rows: T[]) => rows.map((r) => ({ ...r, mes: r.fecha.slice(0, 7) }));
const numeros = <T,>(rows: T[], campos: string[]) =>
  rows.map((r) => { const o = { ...r } as Record<string, unknown>; campos.forEach((c) => (o[c] = Number(o[c] ?? 0))); return o as T; });

export function ProveedorCP({ children }: { children: React.ReactNode }) {
  const { sb } = useApp();
  const [datos, setDatos] = useState<DatosCP>(vacio);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setF] = useState<Filtro>({ mes: "Todos", marca: "Todas" });

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      const [compras, fab, tras, inv, conv, costos, manual] = await Promise.all([
        traerTodo<DatosCP["compras"][number]>(sb, "cp_compras", "id,marca,fecha,almacen,serie,proveedor,familia,centro_costos,articulo,subarticulo,unidades,valor_unitario,total"),
        traerTodo<DatosCP["fab"][number]>(sb, "cp_fabricaciones", "id,marca,fecha,serie,codigo,artifabri,unidad,cantidad,costo"),
        traerTodo<DatosCP["tras"][number]>(sb, "cp_traslados", "id,marca,fecha,serie,sede_destino,articulo,unidad,cantidad,costo"),
        traerTodo<DatosCP["inv"][number]>(sb, "cp_inventarios", "id,marca,fecha,articulo,categoria,unidad,stock_inventario,total"),
        traerTodo<DatosCP["conv"][number]>(sb, "cp_base_conversion", "id,codigo,articulo,unidad,factor"),
        traerTodo<DatosCP["costos"][number]>(sb, "cp_costos_compartidos", "id,mes,concepto,valor"),
        sb.from("cp_reparto_manual").select("mes,pct_san_agustin,actualizado").then((r) => (r.data as DatosCP["manual"]) ?? []),
      ]);
      setDatos({
        compras: conMes(numeros(compras, ["unidades", "valor_unitario", "total"])),
        fab: conMes(numeros(fab, ["cantidad", "costo"])),
        tras: conMes(numeros(tras, ["cantidad", "costo"])),
        inv: conMes(numeros(inv, ["stock_inventario", "total"])),
        conv: numeros(conv, ["factor"]),
        costos: numeros(costos, ["valor"]),
        manual,
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e));
    } finally {
      setCargando(false);
    }
  }, [sb]);

  useEffect(() => { recargar(); }, [recargar]);

  const meses = useMemo(() => {
    const s = new Set<string>();
    [...datos.compras, ...datos.fab, ...datos.tras, ...datos.inv].forEach((r) => s.add(r.mes));
    datos.costos.forEach((r) => s.add(r.mes));
    return [...s].sort();
  }, [datos]);
  const conv = useMemo(() => crearConversor(datos.conv), [datos.conv]);

  return (
    <C.Provider value={{ datos, cargando, error, filtro, setFiltro: (f) => setF((x) => ({ ...x, ...f })), meses, conv, recargar }}>
      {children}
    </C.Provider>
  );
}
