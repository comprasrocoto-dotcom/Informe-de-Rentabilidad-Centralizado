"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/Contexto";
import { BarraFiltros } from "@/components/BarraFiltros";
import { Encabezado } from "@/components/Encabezado";
import { Tarjeta } from "@/components/Indicadores";
import { ListaBarras } from "@/components/ListaBarras";
import { TablaDimension } from "@/components/TablaDimension";
import { fmtM, fmtPct, fmtPesos } from "@/lib/formato";
import { ComparacionSedesCostos } from "@/components/ComparacionSedes";

type V = { clave: string; unidades: number; base: number };
type C = { clave: string; total: number };
const COLS = [
  { clave: "unidades", titulo: "Unidades", tipo: "num" as const },
  { clave: "base", titulo: "Venta base", tipo: "pesos" as const },
];

export default function Participacion() {
  const { sb, filtros, meta } = useApp();
  const [d, setD] = useState<{ cc: V[]; fam: V[]; famC: C[]; ins: C[]; comprasCC: C[]; ventas: number } | null>(null);

  useEffect(() => {
    let vivo = true;
    const base = { p_marca: filtros.marcaId, p_sede: filtros.sedeId, p_desde: filtros.desde || null, p_hasta: filtros.hasta || null };
    Promise.all([
      sb.rpc("ventas_por", { ...base, p_dim: "cc_negocio", p_limite: 20 }),
      sb.rpc("ventas_por", { ...base, p_dim: "familia", p_limite: 12 }),
      sb.rpc("compras_por", { ...base, p_dim: "familia", p_limite: 12, p_operativas: true }),
      sb.rpc("compras_por", { ...base, p_dim: "articulo", p_limite: 1, p_operativas: true }),
      sb.rpc("compras_por", { ...base, p_dim: "centro_costos", p_limite: 50, p_operativas: true }),
      sb.rpc("ventas_kpis", base),
    ]).then(([a, b, c, e, f, k]) => {
      if (!vivo) return;
      setD({ cc: (a.data as V[]) ?? [], fam: (b.data as V[]) ?? [], famC: (c.data as C[]) ?? [], ins: (e.data as C[]) ?? [], comprasCC: (f.data as C[]) ?? [], ventas: Number((k.data as { ventas: number })?.ventas ?? 0) });
    });
    return () => { vivo = false; };
  }, [sb, filtros.marcaId, filtros.sedeId, filtros.desde, filtros.hasta]);

  if (!d) return <div><Encabezado titulo="Participación" /><BarraFiltros sinCC /><p className="text-sm text-texto-2">Cargando…</p></div>;
  const v = d.ventas;
  const compras = d.famC.reduce((a, x) => a + Number(x.total), 0);
  const compraCC = (cc: string) => d.comprasCC.filter((x) => x.clave.toLowerCase().includes(cc.toLowerCase())).reduce((a, x) => a + Number(x.total), 0);
  const ventaCC = (cc: string) => Number(d.cc.find((x) => x.clave === cc)?.base ?? 0);
  const ratio = v ? compras / v : null;

  return (
    <div>
      <Encabezado titulo="Participación" descripcion="Qué pesa más en la venta y en la compra. Ratio compra / venta = compras de Cocina y Bar ÷ ventas (referencia rápida, no reemplaza el juego de inventarios)." />
      <BarraFiltros sinCC />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tarjeta titulo="Centro de costo con más venta" valor={d.cc[0]?.clave ?? "—"} nota={d.cc[0] && v ? `${fmtPct(Number(d.cc[0].base) / v)} de la venta` : undefined} />
        <Tarjeta titulo="Familia con más venta" valor={d.fam[0]?.clave ?? "—"} nota={d.fam[0] && v ? `${fmtPct(Number(d.fam[0].base) / v)} de la venta` : undefined} />
        <Tarjeta titulo="Insumo con más compra" valor={d.ins[0]?.clave ?? "—"} exacto={d.ins[0] ? fmtPesos(Number(d.ins[0].total)) : undefined} />
        <Tarjeta titulo="Ratio compra / venta" valor={fmtPct(ratio)} exacto={`${fmtM(compras)} / ${fmtM(v)}`} tono={ratio != null && ratio > meta ? "alerta" : "bien"} />
      </div>
      <ComparacionSedesCostos metrica="ventas" cc="todos" titulo="Participación de cada sede en la venta" />
      <div className="mb-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        <ListaBarras titulo="Ventas por centro de costo" filas={d.cc.map((x) => ({ k: x.clave, v: Number(x.base), detalle: v ? fmtPct(Number(x.base) / v) : "" }))} formato={fmtM} />
        <ListaBarras titulo="Ventas por familia" filas={d.fam.map((x) => ({ k: x.clave, v: Number(x.base), detalle: v ? fmtPct(Number(x.base) / v) : "" }))} formato={fmtM} />
        <ListaBarras titulo="Compras por familia" nota="Solo Cocina y Bar" color="#eb6834" filas={d.famC.map((x) => ({ k: x.clave, v: Number(x.total), detalle: compras ? fmtPct(Number(x.total) / compras) : "" }))} formato={fmtM} />
        <ListaBarras
          titulo="Ratio compra / venta por centro"
          filas={["Cocina", "Bar"].filter((cc) => ventaCC(cc) > 0).map((cc) => {
            const r = compraCC(cc) / ventaCC(cc);
            return { k: cc, v: r, alerta: r > meta, detalle: `${fmtM(compraCC(cc))} / ${fmtM(ventaCC(cc))}` };
          })}
          formato={(x) => fmtPct(x)}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <TablaDimension rpc="ventas_por" dim="articulo" cc="Cocina" titulo="Top 15 participación · Cocina" nota="% sobre la venta total" columnas={COLS} columnaPrincipal="base" limite={15} totalRef={v || null} />
        <TablaDimension rpc="ventas_por" dim="articulo" cc="Bar" titulo="Top 15 participación · Bar" nota="% sobre la venta total" columnas={COLS} columnaPrincipal="base" limite={15} totalRef={v || null} />
      </div>
    </div>
  );
}
