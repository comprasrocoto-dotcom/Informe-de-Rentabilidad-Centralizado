"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/Contexto";
import { BarraFiltros } from "@/components/BarraFiltros";
import { GraficoBarras, GraficoLinea } from "@/components/Graficos";
import { div, fmtMes, fmtPct, fmtPesos } from "@/lib/formato";
import { bloqueVacio, costoAB, marcarIncompleto, sumarBloques, sumarFila, type Bloque, type FilaResumen } from "@/lib/rentabilidad";

function Kpi({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="tarjeta">
      <div className="text-xs text-stone-500">{titulo}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{valor}</div>
      {nota && <div className="mt-0.5 text-xs text-stone-500">{nota}</div>}
    </div>
  );
}

function Aviso({ b }: { b: Bloque }) {
  if (!b.sinInvInicial && !b.sinInvFinal) return null;
  const txt = b.sinInvInicial && b.sinInvFinal ? "Sin inventarios" : b.sinInvInicial ? "Sin inv. inicial" : "Sin inv. final";
  return <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800" title="Falta el conteo de inventario de este mes o del anterior: el % de costo no es confiable.">⚠ {txt}</span>;
}

export default function Resumen() {
  const { sb, filtros, sedes, marcas } = useApp();
  const [filas, setFilas] = useState<FilaResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    sb.rpc("resumen_mensual", { p_marca: filtros.marcaId, p_desde: filtros.desde || null, p_hasta: filtros.hasta || null })
      .then(({ data, error }) => {
        if (!vivo) return;
        setError(error?.message ?? null);
        setFilas((data as FilaResumen[]) ?? []);
        setCargando(false);
      });
    return () => { vivo = false; };
  }, [sb, filtros.marcaId, filtros.desde, filtros.hasta]);

  const sedePorId = useMemo(() => new Map(sedes.map((s) => [s.id, s])), [sedes]);
  const marcaPorId = useMemo(() => new Map(marcas.map((m) => [m.id, m.nombre])), [marcas]);

  const { total, porMes, porMesSede, produccion } = useMemo(() => {
    const porSedeMes = new Map<string, Bloque>();
    for (const f of filas) {
      if (filtros.sedeId && f.sede_id !== filtros.sedeId) continue;
      const k = `${f.mes}|${f.sede_id}`;
      if (!porSedeMes.has(k)) porSedeMes.set(k, bloqueVacio());
      sumarFila(porSedeMes.get(k)!, f);
    }
    const total = bloqueVacio();
    const porMes = new Map<string, Bloque>();
    const porMesSede: { mes: string; sedeId: number; b: Bloque }[] = [];
    const produccion: { mes: string; sedeId: number; b: Bloque }[] = [];
    for (const [k, b] of porSedeMes) {
      const [mes, sid] = k.split("|");
      const sedeId = Number(sid);
      marcarIncompleto(b);
      const esProd = sedePorId.get(sedeId)?.tipo === "produccion";
      if (esProd && !filtros.sedeId) { produccion.push({ mes, sedeId, b }); continue; }
      porMesSede.push({ mes, sedeId, b });
      if (!porMes.has(mes)) porMes.set(mes, bloqueVacio());
      sumarBloques(porMes.get(mes)!, b);
      sumarBloques(total, b);
    }
    const orden = (a: { mes: string; sedeId: number }, c: { mes: string; sedeId: number }) =>
      a.mes.localeCompare(c.mes) || (sedePorId.get(a.sedeId)?.nombre ?? "").localeCompare(sedePorId.get(c.sedeId)?.nombre ?? "");
    porMesSede.sort(orden);
    produccion.sort(orden);
    return { total, porMes: [...porMes.entries()].sort(([a], [c]) => a.localeCompare(c)), porMesSede, produccion };
  }, [filas, filtros.sedeId, sedePorId]);

  const nombreSede = (id: number) => {
    const s = sedePorId.get(id);
    if (!s) return `Sede ${id}`;
    return filtros.marcaId == null ? `${marcaPorId.get(s.marca_id) ?? ""} · ${s.nombre}` : s.nombre;
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">Resumen de rentabilidad</h1>
        <p className="text-xs text-stone-500">Costo de venta = Inv. inicial + Compras + Traslados − Inv. final · Ventas sin impuestos</p>
      </div>
      <BarraFiltros />
      {error && <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {cargando ? (
        <p className="text-sm text-stone-500">Cargando…</p>
      ) : filas.length === 0 ? (
        <div className="tarjeta text-sm text-stone-600">No hay datos para este filtro. Carga los informes en <a className="text-blue-700 underline" href="/cargar">Cargar datos</a>.</div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Kpi titulo="Ventas (sin impuestos)" valor={fmtPesos(total.ventas)} nota={total.descuentos ? `Incluye descuentos por ${fmtPesos(total.descuentos)}` : undefined} />
            <Kpi titulo="Costo de venta (Cocina + Bar)" valor={fmtPesos(costoAB(total))} />
            <Kpi titulo="% Costo total" valor={fmtPct(div(costoAB(total), total.ventas))} />
            <Kpi titulo="% Costo Cocina" valor={fmtPct(div(total.costoCocina, total.ventasCocina))} nota={`Ventas cocina ${fmtPesos(total.ventasCocina)}`} />
            <Kpi titulo="% Costo Bar" valor={fmtPct(div(total.costoBar, total.ventasBar))} nota={`Ventas bar ${fmtPesos(total.ventasBar)}`} />
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <GraficoBarras titulo="Ventas por mes" datos={porMes.map(([m, b]) => ({ etiqueta: fmtMes(m), valor: b.ventas }))} />
            <GraficoLinea titulo="% Costo de venta por mes" datos={porMes.map(([m, b]) => ({ etiqueta: fmtMes(m), valor: div(costoAB(b), b.ventas) }))} />
          </div>

          <div className="tarjeta overflow-x-auto !p-0">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Mes / Sede</th>
                  <th className="num">Ventas</th>
                  <th className="num">Inv. inicial</th>
                  <th className="num">Compras</th>
                  <th className="num">Traslados</th>
                  <th className="num">Inv. final</th>
                  <th className="num">Costo venta</th>
                  <th className="num">% Costo</th>
                  <th className="num">% Cocina</th>
                  <th className="num">% Bar</th>
                  <th className="num" title="Aseo, empaque, utensilios y otros centros de costo">Otros costos</th>
                </tr>
              </thead>
              <tbody>
                {porMes.map(([mes, bm]) => (
                  <Fragment key={mes}>
                    <tr className="bg-stone-50 font-semibold">
                      <td>{fmtMes(mes)}</td>
                      <td className="num">{fmtPesos(bm.ventas)}</td>
                      <td className="num">{fmtPesos(bm.invInicial)}</td>
                      <td className="num">{fmtPesos(bm.compras)}</td>
                      <td className="num">{fmtPesos(bm.traslados)}</td>
                      <td className="num">{fmtPesos(bm.invFinal)}</td>
                      <td className="num">{fmtPesos(costoAB(bm))}</td>
                      <td className="num">{fmtPct(div(costoAB(bm), bm.ventas))}</td>
                      <td className="num">{fmtPct(div(bm.costoCocina, bm.ventasCocina))}</td>
                      <td className="num">{fmtPct(div(bm.costoBar, bm.ventasBar))}</td>
                      <td className="num">{fmtPesos(bm.costoOtros)}</td>
                    </tr>
                    {porMesSede.filter((x) => x.mes === mes).map(({ sedeId, b }) => (
                      <tr key={`${mes}-${sedeId}`}>
                        <td className="pl-6 text-stone-600">{nombreSede(sedeId)}<Aviso b={b} /></td>
                        <td className="num">{fmtPesos(b.ventas)}</td>
                        <td className="num">{fmtPesos(b.invInicial)}</td>
                        <td className="num">{fmtPesos(b.compras)}</td>
                        <td className="num">{fmtPesos(b.traslados)}</td>
                        <td className="num">{fmtPesos(b.invFinal)}</td>
                        <td className="num">{fmtPesos(costoAB(b))}</td>
                        <td className="num">{fmtPct(div(costoAB(b), b.ventas))}</td>
                        <td className="num">{fmtPct(div(b.costoCocina, b.ventasCocina))}</td>
                        <td className="num">{fmtPct(div(b.costoBar, b.ventasBar))}</td>
                        <td className="num">{fmtPesos(b.costoOtros)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {produccion.length > 0 && (
            <div className="tarjeta mt-4 overflow-x-auto !p-0">
              <div className="px-4 pt-3 text-sm font-medium">Centros de producción <span className="font-normal text-stone-500">(no suman al costo de las sedes: su producción llega como traslados)</span></div>
              <table className="tabla mt-2">
                <thead>
                  <tr><th>Mes / Centro</th><th className="num">Inv. inicial</th><th className="num">Compras</th><th className="num">Inv. final</th></tr>
                </thead>
                <tbody>
                  {produccion.map(({ mes, sedeId, b }) => (
                    <tr key={`${mes}-${sedeId}`}>
                      <td>{fmtMes(mes)} · {nombreSede(sedeId)}</td>
                      <td className="num">{fmtPesos(b.invInicial)}</td>
                      <td className="num">{fmtPesos(b.compras)}</td>
                      <td className="num">{fmtPesos(b.invFinal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
