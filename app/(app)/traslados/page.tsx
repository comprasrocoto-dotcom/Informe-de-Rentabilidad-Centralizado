"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/Contexto";
import { BarraFiltros } from "@/components/BarraFiltros";
import { Encabezado } from "@/components/Encabezado";
import { GraficoBarras } from "@/components/Graficos";
import { Tarjeta } from "@/components/Indicadores";
import { ListaBarras } from "@/components/ListaBarras";
import { TablaDimension } from "@/components/TablaDimension";
import { fmtM, fmtMes, fmtNum, fmtPct, fmtPesos } from "@/lib/formato";

// Traslados = mercancía que llega a cada sede desde el centro de producción / planta (u otra sede).
// Suman al costo de la sede que los recibe (inventario inicial + compras + traslados − inventario final).
type Fila = { clave: string; cantidad: number; total: number; documentos: number; lineas: number };
type Kpis = { total: number; documentos: number; articulos: number; sedes: number; compras: number; ventas: number };

const COLS = [
  { clave: "documentos", titulo: "Documentos", tipo: "num" as const },
  { clave: "total", titulo: "Valor", tipo: "pesos" as const },
];
const COLS_ART = [
  { clave: "cantidad", titulo: "Cantidad", tipo: "dec" as const },
  { clave: "documentos", titulo: "Envíos", tipo: "num" as const },
  { clave: "total", titulo: "Valor", tipo: "pesos" as const },
];

export default function Traslados() {
  const { sb, filtros } = useApp();
  const [k, setK] = useState<Kpis | null>(null);
  const [d, setD] = useState<{ sede: Fila[]; mes: Fila[]; cc: Fila[]; motivo: Fila[] } | null>(null);
  const pcc = filtros.cc === "todos" ? null : filtros.cc;

  useEffect(() => {
    let vivo = true;
    const base = { p_marca: filtros.marcaId, p_sede: filtros.sedeId, p_desde: filtros.desde || null, p_hasta: filtros.hasta || null, p_cc: pcc };
    Promise.all([
      sb.rpc("traslados_kpis", base),
      sb.rpc("traslados_por", { ...base, p_dim: "sede", p_limite: 50 }),
      sb.rpc("traslados_por", { ...base, p_dim: "mes", p_limite: 60 }),
      sb.rpc("traslados_por", { ...base, p_dim: "centro_costos", p_limite: 20 }),
      sb.rpc("traslados_por", { ...base, p_dim: "motivo", p_limite: 20 }),
    ]).then(([kk, s, m, c, mo]) => {
      if (!vivo) return;
      setK(kk.data as Kpis);
      setD({ sede: (s.data as Fila[]) ?? [], mes: (m.data as Fila[]) ?? [], cc: (c.data as Fila[]) ?? [], motivo: (mo.data as Fila[]) ?? [] });
    });
    return () => { vivo = false; };
  }, [sb, filtros.marcaId, filtros.sedeId, filtros.desde, filtros.hasta, pcc]);

  const total = Number(k?.total ?? 0);
  const compras = Number(k?.compras ?? 0);
  const ventas = Number(k?.ventas ?? 0);
  const abastecimiento = total + compras ? total / (total + compras) : null;

  return (
    <div>
      <Encabezado
        titulo="Traslados"
        descripcion="Mercancía que reciben las sedes desde el centro de producción o la planta. Entra al costo de la sede que la recibe: inventario inicial + compras + traslados − inventario final."
      />
      <BarraFiltros />
      {!k || !d ? <p className="text-sm text-texto-2">Cargando…</p> : total === 0 ? (
        <div className="tarjeta text-sm text-texto-2">No hay traslados para este filtro. Las marcas que no tienen centro de producción no registran traslados.</div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="tarjeta col-span-2 border-l-4 border-l-marca md:col-span-1">
              <div className="text-xs text-texto-2">Total trasladado</div>
              <div className="mt-1 text-[32px] leading-none font-semibold tracking-tight text-tinta tabular-nums">{fmtM(total)}</div>
              <div className="mt-1 text-xs text-texto-2 tabular-nums">{fmtPesos(total)}</div>
            </div>
            <Tarjeta titulo="Peso en el abastecimiento" valor={fmtPct(abastecimiento)} nota={`Traslados ÷ (traslados + compras ${pcc ?? "Cocina y Bar"} de las sedes: ${fmtM(compras)})`} />
            <Tarjeta titulo="Traslados sobre ventas" valor={fmtPct(ventas ? total / ventas : null)} nota={`Ventas ${fmtM(ventas)}`} />
            <Tarjeta titulo="Documentos de traslado" valor={fmtNum(Number(k.documentos))} nota={`${fmtNum(Number(k.sedes))} sedes reciben`} />
            <Tarjeta titulo="Artículos distintos" valor={fmtNum(Number(k.articulos))} nota="Subrecetas e insumos enviados" />
          </div>

          <div className="mb-5">
            <GraficoBarras titulo="Traslados por mes" datos={d.mes.map((x) => ({ etiqueta: fmtMes(x.clave), valor: Number(x.total) }))} />
          </div>

          <div className="mb-5 grid gap-3 lg:grid-cols-3">
            <ListaBarras titulo="Por sede que recibe" filas={d.sede.map((x) => ({ k: x.clave, v: Number(x.total), detalle: `${fmtPct(Number(x.total) / total)} · ${fmtNum(Number(x.documentos))} envíos` }))} formato={fmtM} />
            <ListaBarras titulo="Por centro de costo" filas={d.cc.map((x) => ({ k: x.clave, v: Number(x.total), detalle: fmtPct(Number(x.total) / total) }))} formato={fmtM} />
            <ListaBarras titulo="Por motivo" filas={d.motivo.map((x) => ({ k: x.clave, v: Number(x.total), detalle: fmtPct(Number(x.total) / total) }))} formato={fmtM} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <TablaDimension rpc="traslados_por" dim="articulo" titulo="Top 100 artículos trasladados" columnas={COLS_ART} columnaPrincipal="total" limite={100} totalRef={total} />
            <TablaDimension rpc="traslados_por" dim="familia" titulo="Por familia" columnas={COLS} columnaPrincipal="total" totalRef={total} />
            <TablaDimension rpc="traslados_por" dim="tipo_documento" titulo="Por tipo de documento" nota="Recepción de traspaso / tránsito" columnas={COLS} columnaPrincipal="total" totalRef={total} />
            <TablaDimension rpc="traslados_por" dim="sede" titulo="Por sede (detalle)" columnas={COLS_ART} columnaPrincipal="total" totalRef={total} />
          </div>
        </>
      )}
    </div>
  );
}
