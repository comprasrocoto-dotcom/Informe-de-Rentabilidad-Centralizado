"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtMillones, fmtPct, fmtPesos } from "@/lib/formato";

const eje = { fontSize: 11, fill: "var(--text-secondary)" };

function CajaTooltip({ active, payload, label, tipo }: { active?: boolean; payload?: { value: number }[]; label?: string; tipo: "pesos" | "pct" }) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs shadow-sm">
      <div className="text-stone-500">{label}</div>
      <div className="font-semibold tabular-nums">{tipo === "pesos" ? fmtPesos(v) : fmtPct(v)}</div>
    </div>
  );
}

export function GraficoBarras({ datos, titulo }: { datos: { etiqueta: string; valor: number }[]; titulo: string }) {
  return (
    <div className="tarjeta">
      <h3 className="mb-3 text-sm font-medium text-stone-700">{titulo}</h3>
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

export function GraficoLinea({ datos, titulo }: { datos: { etiqueta: string; valor: number | null }[]; titulo: string }) {
  return (
    <div className="tarjeta">
      <h3 className="mb-3 text-sm font-medium text-stone-700">{titulo}</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datos} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="etiqueta" tick={eje} tickLine={false} axisLine={{ stroke: "var(--grid)" }} />
            <YAxis tick={eje} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v * 100)}%`} width={44} />
            <Tooltip cursor={{ stroke: "var(--text-secondary)", strokeDasharray: "3 3" }} content={<CajaTooltip tipo="pct" />} />
            <Line type="monotone" dataKey="valor" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 4, fill: "var(--series-1)", stroke: "#fff", strokeWidth: 2 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
