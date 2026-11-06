"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/Contexto";
import { BarraFiltros } from "@/components/BarraFiltros";
import { PestanasCompras } from "@/components/PestanasCompras";
import { Encabezado } from "@/components/Encabezado";
import { GraficoSeries } from "@/components/Graficos";
import { Tarjeta } from "@/components/Indicadores";
import { TablaDimension } from "@/components/TablaDimension";
import { fmtM, fmtMes, fmtNum, fmtPct, fmtPesos } from "@/lib/formato";
import { ComparacionSedesCostos } from "@/components/ComparacionSedes";

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
  const [datos, setDatos] = useState<{ prov: Fila[]; fam: Fila[]; excl: Fila[]; mes: Fila[]; mesCompras: Fila[] } | null>(null);
  const pcc = filtros.cc === "todos" ? null : filtros.cc;

  useEffect(() => {
    let vivo = true;
    const base = { p_marca: filtros.marcaId, p_sede: filtros.sedeId, p_desde: filtros.desde || null, p_hasta: filtros.hasta || null, p_limite: 1000 };
    Promise.all([
      // Los traslados recibidos se suman a la compra (igual que en el costo)
      sb.rpc("compras_por", { ...base, p_dim: "proveedor", p_cc: pcc, p_operativas: true, p_traslados: true }),
      sb.rpc("compras_por", { ...base, p_dim: "familia", p_cc: pcc, p_operativas: true, p_traslados: true }),
      sb.rpc("compras_por", { ...base, p_dim: "centro_costos", p_cc: null, p_operativas: false, p_traslados: true }),
      sb.rpc("compras_por", { ...base, p_dim: "mes", p_cc: pcc, p_operativas: true, p_traslados: true }),
      sb.rpc("compras_por", { ...base, p_dim: "mes", p_cc: pcc, p_operativas: true, p_traslados: false }),
    ]).then(([p, f, e, m, mc]) => {
      if (vivo) setDatos({ prov: (p.data as Fila[]) ?? [], fam: (f.data as Fila[]) ?? [], excl: (e.data as Fila[]) ?? [], mes: (m.data as Fila[]) ?? [], mesCompras: (mc.data as Fila[]) ?? [] });
    });
    return () => { vivo = false; };
  }, [sb, filtros.marcaId, filtros.sedeId, filtros.desde, filtros.hasta, pcc]);

  const total = (datos?.fam ?? []).reduce((a, x) => a + Number(x.total), 0);
  const excl = (datos?.excl ?? []).reduce((a, x) => a + Number(x.total), 0);
  const ES_TRASLADO = "TRASLADOS CENTRO DE PRODUCCIÓN";
  const traslados = Number((datos?.prov ?? []).find((x) => x.clave === ES_TRASLADO)?.total ?? 0);
  const soloCompras = total - traslados;
  const provActivos = (datos?.prov ?? []).filter((x) => Number(x.total) > 0 && x.clave !== ES_TRASLADO).length;
  const serieMes = (datos?.mes ?? []).map((x) => {
    const c = Number((datos?.mesCompras ?? []).find((y) => y.clave === x.clave)?.total ?? 0);
    return { etiqueta: fmtMes(x.clave), compras: c, traslados: Number(x.total) - c };
  });
  const mayor = datos?.fam[0];

  return (
    <div>
      <Encabezado
        titulo="Compras"
        descripcion={<>Compras <b>+ traslados</b> recibidos del centro de producción, solo con centro de costo <b>{pcc ?? "Cocina o Bar"}</b>: es lo que alimenta el juego de inventarios. Los traslados aparecen como el proveedor &quot;TRASLADOS CENTRO DE PRODUCCIÓN&quot; y se suman a su familia y artículo. Lo demás (aseo, empaque, utensilios…) se muestra aparte como excluido. No incluye el almacén del centro de producción: esas compras llegan a las sedes como traslados (y se ven en el módulo CP); si eliges esa sede en el filtro, sí aparecen.</>}
      />
      <PestanasCompras />
      <BarraFiltros />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Tarjeta titulo={`Compras + traslados ${pcc ?? "Cocina + Bar"}`} valor={fmtM(total)} exacto={fmtPesos(total)} nota={`Compras ${fmtM(soloCompras)} + traslados ${fmtM(traslados)}`} />
        <Tarjeta titulo="Compras excluidas" valor={fmtM(excl)} exacto={fmtPesos(excl)} nota={(datos?.excl ?? []).slice(0, 4).map((x) => `${x.clave} ${fmtM(Number(x.total))}`).join(" · ") || "Sin otros centros de costo"} />
        <Tarjeta titulo="Proveedores activos" valor={fmtNum(provActivos)} nota={traslados ? "Con compra positiva, más los traslados del CP" : "Con compra positiva"} />
        <Tarjeta titulo="Familias compradas" valor={fmtNum(datos?.fam.length ?? 0)} />
        <Tarjeta titulo="Mayor familia" valor={mayor?.clave ?? "—"} exacto={mayor ? fmtPesos(Number(mayor.total)) : undefined} nota={mayor && total ? `${fmtPct(Number(mayor.total) / total)} de compras + traslados` : undefined} />
      </div>
      <ComparacionSedesCostos metrica="compras" />
      <div className="mb-4">
        <GraficoSeries titulo="Evolución mensual: compras y traslados" datos={serieMes}
          series={[{ clave: "compras", nombre: "Compras", color: "#eb6834" }, { clave: "traslados", nombre: "Traslados del CP", color: "#1976d2" }]} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <TablaDimension rpc="compras_por" dim="proveedor" traslados titulo="Por proveedor" nota="Los traslados del centro de producción aparecen como un proveedor más" columnas={COLS} columnaPrincipal="total" limite={100} totalRef={total || null} />
        <TablaDimension rpc="compras_por" dim="familia" traslados titulo="Por familia" nota="Compras + traslados" columnas={COLS} columnaPrincipal="total" totalRef={total || null} />
        <TablaDimension rpc="compras_por" dim="articulo" traslados titulo="Top 100 artículos" nota="Compras + traslados" columnas={COLS_ART} columnaPrincipal="total" limite={100} totalRef={total || null} />
        <TablaDimension rpc="compras_por" dim="centro_costos" operativas={false} traslados cc={null} titulo="Excluidas por centro de costo" nota="Compras y traslados que no entran al costo de mercancía vendida" columnas={COLS} columnaPrincipal="total" />
      </div>
    </div>
  );
}
