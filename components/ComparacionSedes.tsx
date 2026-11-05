"use client";

// Gráfica de comparación por sede, reutilizable en todos los módulos.
//  · "Total del período": barras horizontales ordenadas de mayor a menor, con el valor y la participación.
//  · "Mes a mes": una línea por sede (las 7 con más peso + "Otras sedes", para que se lean los colores).
// La sede elegida en el filtro se resalta; la comparación siempre muestra todas las sedes del filtro de marca.

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApp } from "./Contexto";
import { useCostos } from "@/lib/useCostos";
import { agrupar, cifras, type FiltroCC } from "@/lib/rentabilidad";
import { fmtM, fmtMes, fmtMillones, fmtPct } from "@/lib/formato";

export type FilaSede = { sede: string; mes: string; num: number; den?: number };
export type Agregado = "suma" | "razon" | "ultimo";

// Paleta categórica validada (orden de la guía de visualización), "Otras sedes" en gris
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6"];
const GRIS = "#9e9e9e";
const MAX_LINEAS = 7;
const OTRAS = "Otras sedes (promedio)";
const eje = { fontSize: 11, fill: "var(--text-secondary, #52514e)" };

function agregar(filas: FilaSede[], ag: Agregado) {
  if (!filas.length) return null;
  if (ag === "razon") { const n = filas.reduce((a, f) => a + f.num, 0), d = filas.reduce((a, f) => a + (f.den ?? 0), 0); return d ? n / d : null; }
  if (ag === "ultimo") { const ult = filas.reduce((a, f) => (f.mes > a ? f.mes : a), ""); return filas.filter((f) => f.mes === ult).reduce((a, f) => a + f.num, 0); }
  return filas.reduce((a, f) => a + f.num, 0);
}

export function ComparacionSedes({ titulo, filas, agregado = "suma", formato = fmtM, formatoEje, resaltar, nota, referencia }: {
  titulo: string; filas: FilaSede[]; agregado?: Agregado; formato?: (n: number) => string; formatoEje?: (n: number) => string;
  resaltar?: string | null; nota?: React.ReactNode; referencia?: { valor: number; texto: string } | null;
}) {
  const fEje = formatoEje ?? (formato === fmtM ? fmtMillones : formato);
  const [vista, setVista] = useState<"total" | "mes">("total");
  const { totales, meses, lineas, nombresLinea } = useMemo(() => {
    const porSede = new Map<string, FilaSede[]>();
    filas.forEach((f) => (porSede.get(f.sede) ?? porSede.set(f.sede, []).get(f.sede)!).push(f));
    const totales = [...porSede.entries()].map(([sede, fs]) => ({ sede, valor: agregar(fs, agregado) }))
      .filter((x): x is { sede: string; valor: number } => x.valor !== null && x.valor !== 0)
      .sort((a, b) => b.valor - a.valor);
    const meses = [...new Set(filas.map((f) => f.mes))].sort();
    const principales = totales.slice(0, MAX_LINEAS).map((t) => t.sede);
    const hayOtras = totales.length > MAX_LINEAS;
    const lineas = meses.map((m) => {
      const o: Record<string, string | number | null> = { etiqueta: fmtMes(m) };
      principales.forEach((s) => (o[s] = agregar(filas.filter((f) => f.sede === s && f.mes === m), agregado === "ultimo" ? "suma" : agregado)));
      if (hayOtras) {
        // Promedio por sede (en % es el ponderado), para que no aplaste la escala de las demás
        const resto = filas.filter((f) => !principales.includes(f.sede) && f.mes === m);
        const n = new Set(resto.map((f) => f.sede)).size || 1;
        const v = agregar(resto, agregado === "ultimo" ? "suma" : agregado);
        o[OTRAS] = v === null ? null : agregado === "razon" ? v : v / n;
      }
      return o;
    });
    return { totales, meses, lineas, nombresLinea: hayOtras ? [...principales, OTRAS] : principales };
  }, [filas, agregado]);

  const suma = totales.reduce((a, t) => a + t.valor, 0);
  const conParticipacion = agregado !== "razon";
  const etiqueta = (v: number) => (conParticipacion && suma ? `${formato(v)} · ${fmtPct(v / suma)}` : formato(v));
  const alto = Math.max(140, totales.length * 30 + 30 + (referencia ? 16 : 0));

  return (
    <div className="tarjeta mb-5 overflow-hidden !p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-linea px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-tinta">{titulo}</h3>
          <p className="text-[11px] text-texto-3">
            {vista === "total"
              ? agregado === "ultimo" ? "Último valor del período en cada sede" : agregado === "razon" ? "Del período completo, por sede" : "Suma del período, por sede · participación sobre el total"
              : `Mes a mes${totales.length > MAX_LINEAS ? ` · las ${MAX_LINEAS} sedes con más peso, el resto como promedio` : ""}`}
            {nota ? <> · {nota}</> : null}
          </p>
        </div>
        <div className="flex h-8 overflow-hidden rounded-sm border border-linea bg-white text-[13px]" role="group" aria-label="Vista de la comparación">
          <button type="button" aria-pressed={vista === "total"} onClick={() => setVista("total")} className={`border-r border-linea px-3 ${vista === "total" ? "bg-marca font-medium text-white" : "hover:bg-marca-suave"}`}>Total del período</button>
          <button type="button" aria-pressed={vista === "mes"} onClick={() => setVista("mes")} disabled={meses.length < 2} className={`px-3 disabled:opacity-40 ${vista === "mes" ? "bg-marca font-medium text-white" : "hover:bg-marca-suave"}`}>Mes a mes</button>
        </div>
      </div>
      {!totales.length ? <p className="p-4 text-sm text-texto-3">Sin datos por sede para este filtro.</p> : vista === "total" ? (
        <div className="px-2 py-3" style={{ height: alto }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={totales} layout="vertical" margin={{ top: referencia ? 16 : 0, right: 150, left: 8, bottom: 0 }} barCategoryGap={6}>
              <XAxis type="number" hide domain={[(min: number) => Math.min(0, min), "auto"]} />
              <YAxis type="category" dataKey="sede" width={190} tick={(p: { x?: number | string; y?: number | string; payload?: { value?: unknown } }) => {
                const v = String(p.payload?.value ?? ""); return (
                <text x={Number(p.x) - 4} y={Number(p.y)} dy={4} textAnchor="end" fontSize={12} fontWeight={v === resaltar ? 700 : 400} fill={v === resaltar ? "#0d47a1" : "#333"}>
                  {v.length > 28 ? `${v.slice(0, 27)}…` : v}
                </text>
              ); }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} formatter={(v) => etiqueta(Number(v))} />
              {referencia && <ReferenceLine x={referencia.valor} ifOverflow="extendDomain" stroke="#d32f2f" strokeDasharray="4 3" label={{ value: referencia.texto, position: "top", fill: "#d32f2f", fontSize: 11 }} />}
              <Bar dataKey="valor" name={titulo} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
                {totales.map((t) => {
                  const sobre = referencia && t.valor > referencia.valor;
                  const tenue = resaltar && t.sede !== resaltar;
                  return <Cell key={t.sede} fill={sobre ? (tenue ? "#ef9a9a" : "#d32f2f") : tenue ? "#90caf9" : "#1976d2"} />;
                })}
                <LabelList dataKey="valor" position="right" formatter={(v: unknown) => etiqueta(Number(v))} style={{ fontSize: 12, fill: "#333" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-72 px-2 py-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineas} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--grid, #eee)" />
              <XAxis dataKey="etiqueta" tick={eje} tickLine={false} axisLine={{ stroke: "var(--grid, #eee)" }} padding={{ left: 16, right: 16 }} />
              <YAxis tick={eje} tickLine={false} axisLine={false} tickFormatter={(v) => fEje(Number(v))} width={64} />
              <Tooltip formatter={(v) => formato(Number(v))} itemSorter={(i) => -Number(i.value ?? 0)} />
              <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
              {referencia && <ReferenceLine y={referencia.valor} ifOverflow="extendDomain" stroke="#d32f2f" strokeDasharray="4 3" label={{ value: referencia.texto, position: "insideTopRight", fill: "#d32f2f", fontSize: 11 }} />}
              {nombresLinea.map((s, i) => (
                <Line key={s} type="monotone" dataKey={s} name={s} connectNulls isAnimationActive={false}
                  stroke={s === OTRAS ? GRIS : SERIES[i % SERIES.length]} strokeWidth={s === resaltar ? 3.5 : 2}
                  strokeDasharray={s === OTRAS ? "5 4" : undefined}
                  dot={{ r: 3.5, fill: s === OTRAS ? GRIS : SERIES[i % SERIES.length], stroke: "#fff", strokeWidth: 1.5 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ---------- Versión conectada al motor de costos (ventas, compras, costo, inventario…) ----------

export type MetricaSede = "ventas" | "compras" | "traslados" | "mv" | "pctCosto" | "pctCompra" | "invFinal" | "utilidad";
const CONF: Record<MetricaSede, { titulo: string; agregado: Agregado; pct?: boolean }> = {
  ventas: { titulo: "Ventas por sede", agregado: "suma" },
  compras: { titulo: "Compras por sede", agregado: "suma" },
  traslados: { titulo: "Traslados recibidos por sede", agregado: "suma" },
  mv: { titulo: "Mercancía vendida por sede", agregado: "suma" },
  pctCosto: { titulo: "% costo de mercancía vendida por sede", agregado: "razon", pct: true },
  pctCompra: { titulo: "% de compra sobre venta por sede", agregado: "razon", pct: true },
  invFinal: { titulo: "Inventario final por sede", agregado: "ultimo" },
  utilidad: { titulo: "Utilidad bruta por sede", agregado: "suma" },
};

export function ComparacionSedesCostos({ metrica, cc: ccFijo, titulo, nota }: { metrica: MetricaSede; cc?: FiltroCC; titulo?: string; nota?: React.ReactNode }) {
  const { filtros, meta } = useApp();
  const { filas: crudas, sedePorId } = useCostos();
  const cc = ccFijo ?? (filtros.cc as FiltroCC);
  const filas = useMemo(() => {
    // Se agrupa sin el filtro de sede para poder comparar todas; los centros de producción no son sedes de venta
    const g = agrupar(crudas, (id) => sedePorId.get(id)?.tipo === "produccion", null);
    return g.porMesSede.map(({ mes, sedeId, b }): FilaSede => {
      const c = cifras(b, cc);
      const sede = sedePorId.get(sedeId)?.nombre ?? `Sede ${sedeId}`;
      switch (metrica) {
        case "ventas": return { sede, mes, num: c.ventasTot };
        case "compras": return { sede, mes, num: c.compras };
        case "traslados": return { sede, mes, num: c.traslados };
        case "mv": return { sede, mes, num: c.mv };
        case "utilidad": return { sede, mes, num: c.utilidad };
        case "pctCosto": return { sede, mes, num: c.mv, den: c.ventasBase };
        case "pctCompra": return { sede, mes, num: c.compras + c.traslados, den: c.ventasBase };
        case "invFinal": return { sede, mes, num: c.tieneFin ? c.invFin : 0 };
      }
    });
  }, [crudas, sedePorId, cc, metrica]);
  const conf = CONF[metrica];
  const resaltar = filtros.sedeId ? sedePorId.get(filtros.sedeId)?.nombre : null;
  const textoCC = cc === "todos" ? "" : ` · ${cc}`;
  return (
    <ComparacionSedes
      titulo={`${titulo ?? conf.titulo}${textoCC}`} filas={filas} agregado={conf.agregado}
      formato={conf.pct ? (n) => fmtPct(n) : fmtM} resaltar={resaltar}
      nota={nota ?? (resaltar ? `Resaltada: ${resaltar}` : undefined)}
      referencia={metrica === "pctCosto" ? { valor: meta, texto: `Meta ${fmtPct(meta)}` } : null}
    />
  );
}
