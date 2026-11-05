"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/Contexto";
import { BarraFiltros } from "@/components/BarraFiltros";
import { PestanasCompras } from "@/components/PestanasCompras";
import { Encabezado } from "@/components/Encabezado";
import { GraficoBarras } from "@/components/Graficos";
import { Tarjeta } from "@/components/Indicadores";
import { TablaDimension } from "@/components/TablaDimension";
import { fmtM, fmtMes, fmtNum, fmtPct, fmtPesos } from "@/lib/formato";

const COLS = [
  { clave: "documentos", titulo: "Facturas", tipo: "num" as const },
  { clave: "total", titulo: "Total", tipo: "pesos" as const },
];
const COLS_ART = [
  { clave: "unidades", titulo: "Cantidad", tipo: "dec" as const },
  { clave: "total", titulo: "Total", tipo: "pesos" as const },
];
type Fila = { clave: string; unidades: number; total: number; documentos: number };

export default function Compras() {
  const { sb, filtros } = useApp();
  const [datos, setDatos] = useState<{ prov: Fila[]; fam: Fila[]; excl: Fila[]; mes: Fila[] } | null>(null);
  const pcc = filtros.cc === "todos" ? null : filtros.cc;

  useEffect(() => {
    let vivo = true;
    const base = { p_marca: filtros.marcaId, p_sede: filtros.sedeId, p_desde: filtros.desde || null, p_hasta: filtros.hasta || null, p_limite: 1000 };
    Promise.all([
      sb.rpc("compras_por", { ...base, p_dim: "proveedor", p_cc: pcc, p_operativas: true }),
      sb.rpc("compras_por", { ...base, p_dim: "familia", p_cc: pcc, p_operativas: true }),
      sb.rpc("compras_por", { ...base, p_dim: "centro_costos", p_cc: null, p_operativas: false }),
      sb.rpc("compras_por", { ...base, p_dim: "mes", p_cc: pcc, p_operativas: true }),
    ]).then(([p, f, e, m]) => {
      if (vivo) setDatos({ prov: (p.data as Fila[]) ?? [], fam: (f.data as Fila[]) ?? [], excl: (e.data as Fila[]) ?? [], mes: (m.data as Fila[]) ?? [] });
    });
    return () => { vivo = false; };
  }, [sb, filtros.marcaId, filtros.sedeId, filtros.desde, filtros.hasta, pcc]);

  const total = (datos?.fam ?? []).reduce((a, x) => a + Number(x.total), 0);
  const excl = (datos?.excl ?? []).reduce((a, x) => a + Number(x.total), 0);
  const provActivos = (datos?.prov ?? []).filter((x) => Number(x.total) > 0).length;
  const mayor = datos?.fam[0];

  return (
    <div>
      <Encabezado
        titulo="Compras"
        descripcion={<>Solo entran las compras con centro de costo <b>{pcc ?? "Cocina o Bar"}</b>: son las que alimentan el juego de inventarios. Lo demás (aseo, empaque, utensilios…) se muestra aparte como excluido.</>}
      />
      <PestanasCompras />
      <BarraFiltros />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Tarjeta titulo={`Compras ${pcc ?? "Cocina + Bar"}`} valor={fmtM(total)} exacto={fmtPesos(total)} nota="Base del juego de inventarios" />
        <Tarjeta titulo="Compras excluidas" valor={fmtM(excl)} exacto={fmtPesos(excl)} nota={(datos?.excl ?? []).slice(0, 3).map((x) => `${x.clave} ${fmtM(Number(x.total))}`).join(" · ") || "Sin otros centros de costo"} />
        <Tarjeta titulo="Proveedores activos" valor={fmtNum(provActivos)} nota="Con compra positiva" />
        <Tarjeta titulo="Familias compradas" valor={fmtNum(datos?.fam.length ?? 0)} />
        <Tarjeta titulo="Mayor familia" valor={mayor?.clave ?? "—"} exacto={mayor ? fmtPesos(Number(mayor.total)) : undefined} nota={mayor && total ? `${fmtPct(Number(mayor.total) / total)} de las compras` : undefined} />
      </div>
      <div className="mb-4">
        <GraficoBarras titulo="Evolución mensual de compras" datos={(datos?.mes ?? []).map((x) => ({ etiqueta: fmtMes(x.clave), valor: Number(x.total) }))} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <TablaDimension rpc="compras_por" dim="proveedor" titulo="Por proveedor" columnas={COLS} columnaPrincipal="total" limite={100} totalRef={total || null} />
        <TablaDimension rpc="compras_por" dim="familia" titulo="Por familia" columnas={COLS} columnaPrincipal="total" totalRef={total || null} />
        <TablaDimension rpc="compras_por" dim="articulo" titulo="Top 100 artículos" columnas={COLS_ART} columnaPrincipal="total" limite={100} totalRef={total || null} />
        <TablaDimension rpc="compras_por" dim="centro_costos" operativas={false} cc={null} titulo="Compras excluidas por centro de costo" nota="No entran al costo de mercancía vendida" columnas={COLS} columnaPrincipal="total" />
      </div>
    </div>
  );
}
