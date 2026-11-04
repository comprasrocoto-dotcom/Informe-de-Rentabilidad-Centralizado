"use client";

import { BarraFiltros } from "@/components/BarraFiltros";
import { Encabezado } from "@/components/Encabezado";
import { TablaDimension } from "@/components/TablaDimension";

const COLS = [
  { clave: "unidades", titulo: "Unidades", tipo: "num" as const },
  { clave: "base", titulo: "Venta sin imp.", tipo: "pesos" as const },
  { clave: "neto", titulo: "Venta con imp.", tipo: "pesos" as const },
];

export default function Ventas() {
  return (
    <div>
      <Encabezado titulo="Ventas" descripcion="Lo que se vendió en el período, sin impuestos. Incluye descuentos y todos los centros de costo." />
      <BarraFiltros />
      <div className="grid gap-4 lg:grid-cols-2">
        <TablaDimension rpc="ventas_por" dim="familia" titulo="Por familia" columnas={COLS} columnaPrincipal="base" />
        <TablaDimension rpc="ventas_por" dim="articulo" titulo="Top 100 artículos" columnas={COLS} columnaPrincipal="base" limite={100} />
        <TablaDimension rpc="ventas_por" dim="tarifa" titulo="Por tarifa / canal" columnas={COLS} columnaPrincipal="base" />
        <TablaDimension rpc="ventas_por" dim="tipo_documento" titulo="Por tipo de documento" columnas={COLS} columnaPrincipal="base" />
      </div>
    </div>
  );
}
