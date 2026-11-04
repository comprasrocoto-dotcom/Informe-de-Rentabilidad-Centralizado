"use client";

import { BarraFiltros } from "@/components/BarraFiltros";
import { Encabezado } from "@/components/Encabezado";
import { TablaDimension } from "@/components/TablaDimension";

const COLS = [
  { clave: "documentos", titulo: "Facturas", tipo: "num" as const },
  { clave: "total", titulo: "Total", tipo: "pesos" as const },
];
const COLS_ART = [
  { clave: "unidades", titulo: "Cantidad", tipo: "dec" as const },
  { clave: "total", titulo: "Total", tipo: "pesos" as const },
];

export default function Compras() {
  return (
    <div>
      <Encabezado titulo="Compras" descripcion="Facturas de compra del período, con impuestos, por proveedor, familia y artículo." />
      <BarraFiltros />
      <div className="grid gap-4 lg:grid-cols-2">
        <TablaDimension rpc="compras_por" dim="proveedor" titulo="Por proveedor" columnas={COLS} columnaPrincipal="total" limite={100} />
        <TablaDimension rpc="compras_por" dim="familia" titulo="Por familia" columnas={COLS} columnaPrincipal="total" />
        <TablaDimension rpc="compras_por" dim="centro_costos" titulo="Por centro de costos" columnas={COLS} columnaPrincipal="total" />
        <TablaDimension rpc="compras_por" dim="articulo" titulo="Top 100 artículos" columnas={COLS_ART} columnaPrincipal="total" limite={100} />
      </div>
    </div>
  );
}
