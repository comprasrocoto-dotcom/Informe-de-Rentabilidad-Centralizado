"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtMillones, fmtPct, fmtPesos } from "@/lib/formato";

const eje = { fontSize: 11, fill: "var(--text-secondary)" };

function CajaTooltip({ active, payload, label, tipo }: { active?: boolean; payload?: { value: number }[]; label?: string; tipo: "pesos" | "pct" }) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="rounded-md border border-linea bg-white px-2.5 py-1.5 text-xs shadow-[0_4px_12px_rgba(20,33,61,0.08)]">
      <div className="text-texto-2">{label}</div>
      <div className="font-semibold tabular-nums">{tipo === "pesos" ? fmtPesos(v) : fmtPct(v)}</div>
    </div>
  );
}

export function GraficoBarras({ datos, titulo }: { datos: { etiqueta: string; valor: number }[]; titulo: string }) {
  return (
    <div className="tarjeta">
      <h3 className="mb-3 text-sm font-semibold text-tinta">{titulo}</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="etiqueta" tick={eje} tickLine={false} axisLine={{ stroke: "var(--grid)" }} />
            <YAxis tick={eje} tickLine={false} axisLine={false} tickFormatter={fmtMillones} width={56} />
            <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} content={<CajaTooltip tipo="pesos" />} />
            <Bar dataKey="valor" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function GraficoLinea({ datos, titulo, meta }: { datos: { etiqueta: string; valor: number | null }[]; titulo: string; meta?: number }) {
  // Eje en pasos redondos de 5 o 10 puntos, empezando en 0%
  const max = Math.max(0.05, meta ?? 0, ...datos.map((d) => d.valor ?? 0));
  const paso = max > 0.4 ? 0.1 : 0.05;
  const tope = Math.ceil((max * 1.08) / paso) * paso;
  const ticks = Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => +(i * paso).toFixed(2));
  return (
    <div className="tarjeta">
      <h3 className="mb-3 text-sm font-semibold text-tinta">{titulo}</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datos} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="etiqueta" tick={eje} tickLine={false} axisLine={{ stroke: "var(--grid)" }} padding={{ left: 24, right: 24 }} />
            <YAxis tick={eje} tickLine={false} axisLine={false} domain={[0, tope]} ticks={ticks} tickFormatter={(v) => `${Math.round(v * 100)}%`} width={44} />
            <Tooltip cursor={{ stroke: "var(--text-secondary)", strokeDasharray: "3 3" }} content={<CajaTooltip tipo="pct" />} />
            {meta != null && (
              <ReferenceLine y={meta} stroke="var(--alerta)" strokeDasharray="4 4" label={{ value: `Meta ${Math.round(meta * 100)}%`, position: "insideBottomLeft", fill: "var(--alerta)", fontSize: 11 }} />
            )}
            <Line type="monotone" dataKey="valor" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 4, fill: "var(--series-1)", stroke: "#fff", strokeWidth: 2 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Barras agrupadas de % (Cocina, Bar, Global) por mes, con línea de meta. Colores validados (paleta categórica). */
export function GraficoPctCentros({ datos, titulo, meta }: { datos: { etiqueta: string; Cocina: number | null; Bar: number | null; Global: number | null }[]; titulo: string; meta: number }) {
  const max = Math.max(meta, ...datos.flatMap((d) => [d.Cocina ?? 0, d.Bar ?? 0, d.Global ?? 0]));
  const tope = Math.ceil((max * 1.08) / 0.1) * 0.1;
  const ticks = Array.from({ length: Math.round(tope / 0.1) + 1 }, (_, i) => +(i * 0.1).toFixed(1));
  return (
    <div className="tarjeta">
      <h3 className="mb-3 text-sm font-semibold text-tinta">{titulo}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="etiqueta" tick={eje} tickLine={false} axisLine={{ stroke: "var(--grid)" }} />
            <YAxis tick={eje} tickLine={false} axisLine={false} domain={[0, tope]} ticks={ticks} tickFormatter={(v) => `${Math.round(v * 100)}%`} width={44} />
            <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} formatter={(v) => fmtPct(Number(v))} />
            <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={meta} stroke="var(--alerta)" strokeDasharray="4 4" />
            <Bar dataKey="Cocina" fill="#2a78d6" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="Bar" fill="#eb6834" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="Global" fill="#1baf7a" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Dos series en barras (ej. Venta base vs Costo) por mes. Un solo eje, colores validados. */
export function GraficoDosBarras({ datos, titulo, nombres }: { datos: { etiqueta: string; a: number; b: number }[]; titulo: string; nombres: [string, string] }) {
  return (
    <div className="tarjeta">
      <h3 className="mb-3 text-sm font-semibold text-tinta">{titulo}</h3>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="25%">
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="etiqueta" tick={eje} tickLine={false} axisLine={{ stroke: "var(--grid)" }} />
            <YAxis tick={eje} tickLine={false} axisLine={false} tickFormatter={fmtMillones} width={56} />
            <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} formatter={(v) => fmtPesos(Number(v))} />
            <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="a" name={nombres[0]} fill="#2a78d6" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="b" name={nombres[1]} fill="#eb6834" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
