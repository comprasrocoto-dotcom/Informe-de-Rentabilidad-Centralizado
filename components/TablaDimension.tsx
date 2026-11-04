"use client";

import { useEffect, useState } from "react";
import { useApp } from "./Contexto";
import { fmtDec, fmtNum, fmtPct, fmtPesos } from "@/lib/formato";

type Col = { clave: string; titulo: string; tipo: "pesos" | "num" | "dec" };

export function TablaDimension({
  rpc, dim, titulo, columnas, columnaPrincipal, limite = 50,
}: {
  rpc: "ventas_por" | "compras_por";
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
    sb.rpc(rpc, {
      p_dim: dim, p_marca: filtros.marcaId, p_sede: filtros.sedeId,
      p_desde: filtros.desde || null, p_hasta: filtros.hasta || null, p_limite: limite,
    }).then(({ data, error }) => {
      if (!vivo) return;
      setError(error?.message ?? null);
      setFilas((data as Record<string, number | string>[]) ?? []);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, [sb, rpc, dim, limite, filtros.marcaId, filtros.sedeId, filtros.desde, filtros.hasta]);

  const total = filas.reduce((a, f) => a + Number(f[columnaPrincipal] || 0), 0);
  const fmt = (t: Col["tipo"], v: unknown) => (t === "pesos" ? fmtPesos(Number(v)) : t === "dec" ? fmtDec(Number(v)) : fmtNum(Number(v)));

  return (
    <div className="tarjeta overflow-hidden !p-0">
      <h3 className="px-4 pt-3 text-sm font-medium text-stone-700">{titulo}</h3>
      {error && <p className="m-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <div className="mt-2 max-h-[28rem] overflow-auto">
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
              <tr><td colSpan={columnas.length + 2} className="text-stone-500">Cargando…</td></tr>
            ) : filas.length === 0 ? (
              <tr><td colSpan={columnas.length + 2} className="text-stone-500">Sin datos</td></tr>
            ) : (
              filas.map((f, i) => {
                const share = total ? Number(f[columnaPrincipal]) / total : 0;
                return (
                  <tr key={i}>
                    <td className="max-w-xs truncate" title={String(f.clave)}>{String(f.clave)}</td>
                    {columnas.map((c) => <td key={c.clave} className="num">{fmt(c.tipo, f[c.clave])}</td>)}
                    <td className="num">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-stone-100">
                          <div className="h-full rounded-full bg-[var(--series-1)]" style={{ width: `${Math.max(0, Math.min(1, share)) * 100}%` }} />
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
