"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/Contexto";
import { BarraFiltros } from "@/components/BarraFiltros";
import { Encabezado } from "@/components/Encabezado";
import { GraficoLinea } from "@/components/Graficos";
import { Tarjeta } from "@/components/Indicadores";
import { ListaBarras } from "@/components/ListaBarras";
import { fmtM, fmtMes, fmtNum, fmtPct, fmtPesos } from "@/lib/formato";

// Descuento = valor de las líneas de venta marcadas como descuento (socios, comercial, empleados,
// cumpleaños, cortesía, reuniones, estrategia socios…), neto de sus reversos en notas crédito.
// % sobre ventas = descuentos ÷ ventas totales (base neta, sin IVA ni propinas).
// % sobre venta bruta = descuentos ÷ (ventas totales + descuentos), es decir, antes de descontar.
type PorMes = { m: number; s: number; mes: string; ventas: number; descuentos: number | null; lineas: number };
type PorTipo = { m: number; tipo: string; descuentos: number; lineas: number };

const pct = (d: number, v: number) => (v ? d / v : null);

export default function Descuentos() {
  const { sb, filtros, sedes, marcas } = useApp();
  const [datos, setDatos] = useState<{ por_mes: PorMes[]; por_tipo: PorTipo[] } | null>(null);

  useEffect(() => {
    let vivo = true;
    setDatos(null);
    sb.rpc("descuentos_resumen", { p_marca: filtros.marcaId, p_sede: filtros.sedeId, p_desde: filtros.desde || null, p_hasta: filtros.hasta || null })
      .then(({ data }) => { if (vivo) setDatos((data as typeof datos) ?? { por_mes: [], por_tipo: [] }); });
    return () => { vivo = false; };
  }, [sb, filtros.marcaId, filtros.sedeId, filtros.desde, filtros.hasta]);

  const sedeNombre = (id: number) => sedes.find((s) => s.id === id)?.nombre ?? `Sede ${id}`;
  const marcaNombre = (id: number) => marcas.find((m) => m.id === id)?.nombre ?? "";

  const r = useMemo(() => {
    const filas = (datos?.por_mes ?? []).map((x) => ({ ...x, ventas: Number(x.ventas), descuentos: Number(x.descuentos ?? 0) }));
    const ventas = filas.reduce((a, x) => a + x.ventas, 0);
    const desc = filas.reduce((a, x) => a + x.descuentos, 0);
    const lineas = filas.reduce((a, x) => a + Number(x.lineas), 0);
    const meses = [...new Set(filas.map((x) => x.mes))].sort();
    const porMes = meses.map((m) => {
      const f = filas.filter((x) => x.mes === m);
      return { mes: m, ventas: f.reduce((a, x) => a + x.ventas, 0), desc: f.reduce((a, x) => a + x.descuentos, 0), filas: f };
    });
    const tipos = new Map<string, { d: number; l: number }>();
    (datos?.por_tipo ?? []).forEach((t) => {
      const o = tipos.get(t.tipo) ?? { d: 0, l: 0 };
      o.d += Number(t.descuentos); o.l += Number(t.lineas);
      tipos.set(t.tipo, o);
    });
    const porMarca = new Map<number, { v: number; d: number }>();
    filas.forEach((x) => {
      const o = porMarca.get(x.m) ?? { v: 0, d: 0 };
      o.v += x.ventas; o.d += x.descuentos;
      porMarca.set(x.m, o);
    });
    return { ventas, desc, lineas, porMes, tipos: [...tipos.entries()].sort((a, b) => b[1].d - a[1].d), porMarca: [...porMarca.entries()] };
  }, [datos]);

  const variasSedes = new Set((datos?.por_mes ?? []).map((x) => x.s)).size > 1;

  return (
    <div>
      <Encabezado
        titulo="Descuentos"
        descripcion="Cuánto representan los descuentos sobre la venta. Se cuentan las líneas de descuento del informe de ventas (socios, comerciales, empleados, cumpleaños, cortesías, estrategia socios…), restando sus reversos en notas crédito."
      />
      <BarraFiltros sinCC />
      {!datos ? <p className="text-sm text-texto-2">Cargando…</p> : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="tarjeta col-span-2 border-l-4 border-l-marca md:col-span-1">
              <div className="text-xs font-medium text-texto-2">Descuentos sobre la venta</div>
              <div className="mt-1 text-[40px] leading-none font-semibold tracking-tight text-tinta tabular-nums">{fmtPct(pct(r.desc, r.ventas))}</div>
              <div className="mt-2 text-xs text-texto-3">Descuentos ÷ ventas totales</div>
            </div>
            <Tarjeta titulo="Descuentos" valor={fmtM(r.desc)} exacto={fmtPesos(r.desc)} nota={`${fmtNum(r.lineas)} líneas de descuento`} />
            <Tarjeta titulo="Ventas totales" valor={fmtM(r.ventas)} exacto={fmtPesos(r.ventas)} nota="Base neta: sin IVA ni propinas, ya con descuentos" />
            <Tarjeta titulo="Venta bruta" valor={fmtM(r.ventas + r.desc)} exacto={fmtPesos(r.ventas + r.desc)} nota="Ventas antes de descuentos" />
            <Tarjeta titulo="% sobre venta bruta" valor={fmtPct(pct(r.desc, r.ventas + r.desc))} nota="Descuentos ÷ venta bruta" />
          </div>

          {r.desc === 0 && r.ventas > 0 && (
            <p className="mb-5 rounded-md bg-alerta-suave p-3 text-sm text-alerta">
              En este período no hay líneas de descuento en el informe de ventas. Si la marca aplica descuentos dentro del precio (por ejemplo, con una tarifa de personal), no aparecen como descuento aquí.
            </p>
          )}

          <div className="mb-5 grid gap-3 lg:grid-cols-[1.3fr_1fr]">
            <GraficoLinea titulo="% de descuento sobre la venta, por mes" datos={r.porMes.map((x) => ({ etiqueta: fmtMes(x.mes), valor: pct(x.desc, x.ventas) }))} />
            <ListaBarras
              titulo="Descuentos por tipo"
              vacio="Sin descuentos en el período"
              filas={r.tipos.map(([k, o]) => ({ k, v: o.d, detalle: `${fmtPct(pct(o.d, r.desc))} · ${fmtNum(o.l)} líneas` }))}
              formato={fmtM}
            />
          </div>

          {filtros.marcaId == null && r.porMarca.length > 1 && (
            <div className="mb-5">
              <ListaBarras
                titulo="% de descuento sobre la venta, por marca"
                filas={r.porMarca.map(([m, o]) => ({ k: marcaNombre(m), v: pct(o.d, o.v) ?? 0, detalle: `${fmtM(o.d)} de ${fmtM(o.v)}` })).sort((a, b) => b.v - a.v)}
                formato={(v) => fmtPct(v)}
              />
            </div>
          )}

          <div className="tarjeta overflow-hidden !p-0">
            <div className="flex items-baseline justify-between gap-2 border-b border-linea px-4 py-3">
              <h2 className="text-sm font-semibold text-tinta">Detalle por mes{variasSedes ? " y sede" : ""}</h2>
              <span className="text-xs text-texto-3">Pesos, sin impuestos</span>
            </div>
            <div className="max-h-[60vh] overflow-auto">
              <table className="tabla col-fija">
                <thead><tr><th className="min-w-56">Mes{variasSedes ? " / sede" : ""}</th><th className="num">Ventas totales</th><th className="num">Descuentos</th><th className="num">% sobre ventas</th><th className="num">Venta bruta</th><th className="num">% sobre venta bruta</th></tr></thead>
                <tbody>
                  {r.porMes.map((x) => (
                    <Fragment key={x.mes}>
                      <tr className="grupo">
                        <td className="capitalize">{fmtMes(x.mes)}</td>
                        <td className="num">{fmtNum(x.ventas)}</td><td className="num">{fmtNum(x.desc)}</td>
                        <td className="num">{fmtPct(pct(x.desc, x.ventas))}</td>
                        <td className="num">{fmtNum(x.ventas + x.desc)}</td><td className="num">{fmtPct(pct(x.desc, x.ventas + x.desc))}</td>
                      </tr>
                      {variasSedes && x.filas.map((f) => (
                        <tr key={`${x.mes}-${f.s}`}>
                          <td className="pl-6 text-texto-2">{filtros.marcaId == null ? `${marcaNombre(f.m)} · ` : ""}{sedeNombre(f.s)}</td>
                          <td className="num">{fmtNum(f.ventas)}</td><td className="num">{fmtNum(f.descuentos)}</td>
                          <td className="num">{fmtPct(pct(f.descuentos, f.ventas))}</td>
                          <td className="num">{fmtNum(f.ventas + f.descuentos)}</td><td className="num">{fmtPct(pct(f.descuentos, f.ventas + f.descuentos))}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
