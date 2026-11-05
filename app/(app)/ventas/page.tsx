"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/Contexto";
import { BarraFiltros } from "@/components/BarraFiltros";
import { Encabezado } from "@/components/Encabezado";
import { Tarjeta } from "@/components/Indicadores";
import { TablaDimension } from "@/components/TablaDimension";
import { fmtM, fmtNum, fmtPesos } from "@/lib/formato";
import { ComparacionSedesCostos } from "@/components/ComparacionSedes";

const COLS = [
  { clave: "unidades", titulo: "Unidades", tipo: "num" as const },
  { clave: "base", titulo: "Venta base", tipo: "pesos" as const },
];
const COLS_TODAS = [...COLS, { clave: "neto", titulo: "Venta con imp.", tipo: "pesos" as const }];

export default function Ventas() {
  const { sb, filtros } = useApp();
  const [k, setK] = useState<{ ventas: number; unidades: number; sedes: number; familias: number; facturas: number } | null>(null);
  const pcc = filtros.cc === "todos" ? null : filtros.cc;

  useEffect(() => {
    let vivo = true;
    sb.rpc("ventas_kpis", { p_marca: filtros.marcaId, p_sede: filtros.sedeId, p_desde: filtros.desde || null, p_hasta: filtros.hasta || null, p_cc: pcc })
      .then(({ data }) => { if (vivo) setK(data as typeof k); });
    return () => { vivo = false; };
  }, [sb, filtros.marcaId, filtros.sedeId, filtros.desde, filtros.hasta, pcc]);

  const ventas = Number(k?.ventas ?? 0);
  const centros: ("Cocina" | "Bar")[] = pcc ? [pcc] : ["Cocina", "Bar"];

  return (
    <div>
      <Encabezado titulo="Ventas" descripcion="Venta base neta: sin IVA ni propinas. Incluye notas crédito y descuentos (restan). Las líneas en $0 no cuentan." />
      <BarraFiltros />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Tarjeta titulo="Ventas totales" valor={fmtM(ventas)} exacto={fmtPesos(ventas)} nota="Base neta sin IVA" />
        <Tarjeta titulo="Unidades vendidas" valor={fmtNum(Number(k?.unidades ?? 0))} />
        <Tarjeta titulo="Sedes activas" valor={fmtNum(Number(k?.sedes ?? 0))} nota="Con venta en el filtro" />
        <Tarjeta titulo="Familias con venta" valor={fmtNum(Number(k?.familias ?? 0))} />
        <Tarjeta titulo="Ticket promedio" valor={k?.facturas ? fmtPesos(ventas / Number(k.facturas)) : "—"} nota={k?.facturas ? `${fmtNum(Number(k.facturas))} facturas` : "Vuelve a subir las ventas para contar facturas"} />
      </div>
      <ComparacionSedesCostos metrica="ventas" />
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <TablaDimension rpc="ventas_por" dim="cc_negocio" titulo="Participación por centro de costo" nota="Eventos se reparte entre Cocina y Bar según el artículo" columnas={COLS} columnaPrincipal="base" totalRef={ventas || null} />
        <TablaDimension rpc="ventas_por" dim="familia" titulo="Ventas por familia" columnas={COLS} columnaPrincipal="base" totalRef={ventas || null} />
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        {centros.map((cc) => (
          <TablaDimension key={`mas-${cc}`} rpc="ventas_por" dim="articulo" cc={cc} titulo={`Top 15 más vendidos · ${cc}`} columnas={COLS} columnaPrincipal="base" limite={15} />
        ))}
        {centros.map((cc) => (
          <TablaDimension key={`menos-${cc}`} rpc="ventas_por" dim="articulo" cc={cc} orden="asc" titulo={`Top 15 menos vendidos · ${cc}`} nota="Por unidades, entre los que tuvieron venta" columnas={COLS} columnaPrincipal="base" limite={15} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <TablaDimension rpc="ventas_por" dim="tarifa" titulo="Por tarifa / canal" columnas={COLS_TODAS} columnaPrincipal="base" totalRef={ventas || null} />
        <TablaDimension rpc="ventas_por" dim="tipo_documento" titulo="Por tipo de documento" columnas={COLS_TODAS} columnaPrincipal="base" totalRef={ventas || null} />
      </div>
    </div>
  );
}
