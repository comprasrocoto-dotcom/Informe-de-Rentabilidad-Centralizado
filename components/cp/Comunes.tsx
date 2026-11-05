"use client";

import { fmtNum, fmtPesos } from "@/lib/formato";
import { TarjetaColor } from "@/components/TarjetaColor";
import type { MarcaCP } from "@/lib/cp/importadorCP";
import { COLOR_MARCA } from "./NavCP";

export function Kpi({ titulo, valor, sub, vacio }: { titulo: string; valor: string; sub?: string; vacio?: boolean }) {
  return <TarjetaColor titulo={titulo} valor={valor} nota={sub} apagada={vacio} />;
}

export function Seccion({ titulo, nota, children, accion }: { titulo: string; nota?: React.ReactNode; children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <section className="tarjeta mb-5 overflow-hidden !p-0">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-linea px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-tinta">{titulo}</h2>
          {nota && <p className="text-xs text-texto-3">{nota}</p>}
        </div>
        {accion}
      </div>
      <div className="overflow-auto">{children}</div>
    </section>
  );
}

export function Aviso({ children, tono = "info" }: { children: React.ReactNode; tono?: "info" | "vacio" }) {
  return <div className={`mb-5 rounded-sm border p-3 text-sm ${tono === "vacio" ? "border-dashed border-linea bg-white text-texto-2" : "border-celeste/60 bg-marca-suave text-texto"}`}>{children}</div>;
}

export function BarrasMarca({ sa, ro, formato = fmtPesos, pct }: { sa: number; ro: number; formato?: (n: number) => string; pct?: [number | null, number | null] }) {
  const max = Math.max(Math.abs(sa), Math.abs(ro), 1);
  return (
    <div className="space-y-3 p-4">
      {([["San Agustín", sa, pct?.[0]], ["Rocoto", ro, pct?.[1]]] as [MarcaCP, number, number | null | undefined][]).map(([m, v, p]) => (
        <div key={m} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-[13px]">
          <span>{m}</span>
          <div className="h-3 overflow-hidden rounded-sm bg-linea-suave"><div className="h-full rounded-sm" style={{ width: `${(Math.abs(v) / max) * 100}%`, background: COLOR_MARCA[m] }} /></div>
          <span className="text-right tabular-nums">{formato(v)}{p != null ? ` (${p}%)` : ""}</span>
        </div>
      ))}
    </div>
  );
}

export const fmtKg = (n: number | null | undefined) => (n == null ? "—" : `${fmtNum(Math.round(n * 10) / 10)} kg`);
export const fmtCant = (n: number | null | undefined) => (n == null ? "—" : (Math.round(n * 10) / 10).toLocaleString("es-CO"));

export async function exportarExcel(nombre: string, hoja: string, filas: Record<string, unknown>[]) {
  if (!filas.length) return;
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(filas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, hoja.slice(0, 31));
  XLSX.writeFile(wb, nombre);
}
