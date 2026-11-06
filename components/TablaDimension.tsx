"use client";

import { useEffect, useState } from "react";
import { useApp } from "./Contexto";
import { fmtDec, fmtNum, fmtPct } from "@/lib/formato";

type Col = { clave: string; titulo: string; tipo: "pesos" | "num" | "dec" };

export function TablaDimension({
  rpc, dim, titulo, columnas, columnaPrincipal, limite = 50, cc, orden, operativas, nota, ccDesdeFiltro = true, totalRef, traslados,
}: {
  cc?: "Cocina" | "Bar" | null;
  orden?: "asc" | "desc";
  operativas?: boolean | null;
  traslados?: boolean; // compras_por: sumar los traslados recibidos a la compra
  nota?: string;
  /** si no se pasa `cc`, usa el filtro Cocina/Bar de la barra */
  ccDesdeFiltro?: boolean;
  /** total contra el que se calcula la participación (si no, la suma de las filas mostradas) */
  totalRef?: number | null;
  rpc: "ventas_por" | "compras_por" | "traslados_por";
  dim: string;
  titulo: string;
  columnas: Col[];
  columnaPrincipal: string;
  limite?: number;
}) {
  const { sb, filtros } = useApp();
  const [filas, setFilas] = useState<Record<string, number | string>[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const ccEf = cc !== undefined ? cc : ccDesdeFiltro && filtros.cc !== "todos" ? filtros.cc : null;
    const extra: Record<string, unknown> = { p_cc: ccEf };
    if (rpc === "ventas_por") extra.p_orden = orden ?? "desc";
    if (rpc === "compras_por") { extra.p_operativas = operativas === undefined ? true : operativas; extra.p_traslados = traslados ?? false; }
    sb.rpc(rpc, {
      p_dim: dim, p_marca: filtros.marcaId, p_sede: filtros.sedeId,
      p_desde: filtros.desde || null, p_hasta: filtros.hasta || null, p_limite: limite, ...extra,
    }).then(({ data, error }) => {
      if (!vivo) return;
      setError(error?.message ?? null);
      setFilas((data as Record<string, number | string>[]) ?? []);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, [sb, rpc, dim, limite, filtros.marcaId, filtros.sedeId, filtros.desde, filtros.hasta, filtros.cc, cc, orden, operativas, ccDesdeFiltro, traslados]);

  const total = totalRef ?? filas.reduce((a, f) => a + Number(f[columnaPrincipal] || 0), 0);
  const mayor = Math.max(1, ...filas.map((f) => Number(f[columnaPrincipal] || 0)));
  const fmt = (t: Col["tipo"], v: unknown) => (t === "dec" ? fmtDec(Number(v)) : fmtNum(Number(v)));

  return (
    <div className="tarjeta overflow-hidden !p-0">
      <div className="flex items-baseline justify-between gap-2 border-b border-linea px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-tinta">{titulo}</h3>
          {nota && <p className="text-[11px] text-texto-3">{nota}</p>}
        </div>
        {columnas.some((c) => c.tipo === "pesos") && <span className="text-[11px] text-texto-3">Pesos colombianos</span>}
      </div>
      {error && <p className="m-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <div className="max-h-[26rem] overflow-auto">
        <table className="tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              {columnas.map((c) => <th key={c.clave} className="num">{c.titulo}</th>)}
              <th className="num">% del total</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={columnas.length + 2} className="text-texto-2">Cargando…</td></tr>
            ) : filas.length === 0 ? (
              <tr><td colSpan={columnas.length + 2} className="text-texto-2">Sin datos</td></tr>
            ) : (
              filas.map((f, i) => {
                const share = total ? Number(f[columnaPrincipal]) / total : 0;
                return (
                  <tr key={i}>
                    <td className="max-w-[18rem] truncate" title={String(f.clave)}>{String(f.clave)}</td>
                    {columnas.map((c) => <td key={c.clave} className="num">{fmt(c.tipo, f[c.clave])}</td>)}
                    <td className="num">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-linea-suave">
                          <div className="h-full rounded-full bg-[var(--series-1)]" style={{ width: `${Math.max(0, Math.min(1, Number(f[columnaPrincipal]) / mayor)) * 100}%` }} />
                        </div>
                        <span className="w-12">{fmtPct(share)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
