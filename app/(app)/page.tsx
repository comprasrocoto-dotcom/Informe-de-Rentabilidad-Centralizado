"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/Contexto";
import { BarraFiltros } from "@/components/BarraFiltros";
import { Encabezado } from "@/components/Encabezado";
import { GraficoBarras, GraficoLinea } from "@/components/Graficos";
import { div, fmtMes, fmtNum, fmtPct, fmtPesos } from "@/lib/formato";
import { bloqueVacio, costoAB, marcarIncompleto, sumarBloques, sumarFila, type Bloque, type FilaResumen } from "@/lib/rentabilidad";

function Kpi({ titulo, valor, nota }: { titulo: string; valor: string; nota?: React.ReactNode }) {
  return (
    <div className="tarjeta flex flex-col justify-between">
      <div className="text-xs font-medium text-texto-2">{titulo}</div>
      <div className="mt-2 text-xl font-semibold text-tinta tabular-nums">{valor}</div>
      {nota && <div className="mt-1 text-xs text-texto-3">{nota}</div>}
    </div>
  );
}

function Aviso({ b }: { b: Bloque }) {
  if (!b.sinInvInicial && !b.sinInvFinal) return null;
  const txt = b.sinInvInicial && b.sinInvFinal ? "Sin inventarios" : b.sinInvInicial ? "Sin inv. inicial" : "Sin inv. final";
  return (
    <span className="ml-2 rounded bg-alerta-suave px-1.5 py-0.5 text-[11px] font-medium text-alerta" title="Falta el conteo de inventario de este mes o del anterior: el % de costo no es confiable.">
      {txt}
    </span>
  );
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

  // Variación del % de costo del último mes frente al anterior
  const ultimo = porMes[porMes.length - 1];
  const penultimo = porMes[porMes.length - 2];
  const pctUltimo = ultimo ? div(costoAB(ultimo[1]), ultimo[1].ventas) : null;
  const pctPenultimo = penultimo ? div(costoAB(penultimo[1]), penultimo[1].ventas) : null;
  const variacion = pctUltimo != null && pctPenultimo != null ? (pctUltimo - pctPenultimo) * 100 : null;
  const pctTotal = div(costoAB(total), total.ventas);

  return (
    <div>
      <Encabezado
        titulo="Resumen de rentabilidad"
        descripcion="Costo de venta = inventario inicial + compras + traslados − inventario final. Solo centros de costo Cocina y Bar, ventas sin impuestos."
      />
      <BarraFiltros />
      {error && <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {cargando ? (
        <p className="text-sm text-texto-2">Cargando…</p>
      ) : filas.length === 0 ? (
        <div className="tarjeta text-sm text-texto-2">
          No hay datos para este filtro. Sube los informes en <a className="font-medium text-marca underline" href="/cargar">Cargar datos</a>.
        </div>
      ) : (
        <>
          <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
            <div className="tarjeta border-l-4 border-l-marca md:col-span-2 xl:col-span-1">
              <div className="text-xs font-medium text-texto-2">% Costo de venta del período</div>
              <div className="mt-1 text-[40px] leading-none font-semibold tracking-tight text-tinta tabular-nums">{fmtPct(pctTotal)}</div>
              <div className="mt-2 text-xs text-texto-2">
                {variacion == null ? (
                  "Elige más de un mes para ver la variación."
                ) : (
                  <>
                    <span className={variacion > 0 ? "font-medium text-alerta" : "font-medium text-bien"}>
                      {variacion > 0 ? "▲" : "▼"} {Math.abs(variacion).toLocaleString("es-CO", { maximumFractionDigits: 1 })} pts
                    </span>{" "}
                    en {fmtMes(ultimo[0])} frente a {fmtMes(penultimo[0])}
                  </>
                )}
              </div>
            </div>
            <Kpi
              titulo="Ventas Cocina + Bar"
              valor={fmtPesos(total.ventas)}
              nota="Sin impuestos ni descuentos"
            />
            <Kpi titulo="Costo de venta" valor={fmtPesos(costoAB(total))} nota={`Aseo, empaque y otros: ${fmtPesos(total.costoOtros)}`} />
            <Kpi titulo="% Costo Cocina" valor={fmtPct(div(total.costoCocina, total.ventasCocina))} nota={`Ventas ${fmtPesos(total.ventasCocina)}`} />
            <Kpi titulo="% Costo Bar" valor={fmtPct(div(total.costoBar, total.ventasBar))} nota={`Ventas ${fmtPesos(total.ventasBar)}`} />
          </div>

          <div className="mb-5 grid gap-3 lg:grid-cols-2">
            <GraficoBarras titulo="Ventas Cocina + Bar por mes" datos={porMes.map(([m, b]) => ({ etiqueta: fmtMes(m), valor: b.ventas }))} />
            <GraficoLinea titulo="% Costo de venta por mes" datos={porMes.map(([m, b]) => ({ etiqueta: fmtMes(m), valor: div(costoAB(b), b.ventas) }))} />
          </div>

          <div className="tarjeta overflow-hidden !p-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-linea px-4 py-3">
              <h2 className="text-sm font-semibold text-tinta">Detalle por mes y sede</h2>
              <span className="text-xs text-texto-3">Cifras en pesos colombianos, sin impuestos</span>
            </div>
            <div className="max-h-[65vh] overflow-auto">
              <table className="tabla col-fija">
                <thead>
                  <tr>
                    <th className="min-w-56">Mes / sede</th>
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
                      <tr className="grupo">
                        <td className="capitalize">{fmtMes(mes)}</td>
                        <td className="num">{fmtNum(bm.ventas)}</td>
                        <td className="num">{fmtNum(bm.invInicial)}</td>
                        <td className="num">{fmtNum(bm.compras)}</td>
                        <td className="num">{fmtNum(bm.traslados)}</td>
                        <td className="num">{fmtNum(bm.invFinal)}</td>
                        <td className="num">{fmtNum(costoAB(bm))}</td>
                        <td className="num">{fmtPct(div(costoAB(bm), bm.ventas))}</td>
                        <td className="num">{fmtPct(div(bm.costoCocina, bm.ventasCocina))}</td>
                        <td className="num">{fmtPct(div(bm.costoBar, bm.ventasBar))}</td>
                        <td className="num">{fmtNum(bm.costoOtros)}</td>
                      </tr>
                      {porMesSede.filter((x) => x.mes === mes).map(({ sedeId, b }) => (
                        <tr key={`${mes}-${sedeId}`}>
                          <td className="pl-6 text-texto-2">{nombreSede(sedeId)}<Aviso b={b} /></td>
                          <td className="num">{fmtNum(b.ventas)}</td>
                          <td className="num">{fmtNum(b.invInicial)}</td>
                          <td className="num">{fmtNum(b.compras)}</td>
                          <td className="num">{fmtNum(b.traslados)}</td>
                          <td className="num">{fmtNum(b.invFinal)}</td>
                          <td className="num">{fmtNum(costoAB(b))}</td>
                          <td className="num font-medium">{fmtPct(div(costoAB(b), b.ventas))}</td>
                          <td className="num">{fmtPct(div(b.costoCocina, b.ventasCocina))}</td>
                          <td className="num">{fmtPct(div(b.costoBar, b.ventasBar))}</td>
                          <td className="num text-texto-2">{fmtNum(b.costoOtros)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {produccion.length > 0 && (
            <div className="tarjeta mt-5 overflow-hidden !p-0">
              <div className="border-b border-linea px-4 py-3">
                <h2 className="text-sm font-semibold text-tinta">Centros de producción</h2>
                <p className="text-xs text-texto-3">No suman al costo de las sedes: su producción llega a ellas como traslados.</p>
              </div>
              <div className="max-h-[40vh] overflow-auto">
                <table className="tabla">
                  <thead>
                    <tr><th>Mes / centro</th><th className="num">Inv. inicial</th><th className="num">Compras</th><th className="num">Inv. final</th></tr>
                  </thead>
                  <tbody>
                    {produccion.map(({ mes, sedeId, b }) => (
                      <tr key={`${mes}-${sedeId}`}>
                        <td><span className="capitalize">{fmtMes(mes)}</span> · {nombreSede(sedeId)}</td>
                        <td className="num">{fmtNum(b.invInicial)}</td>
                        <td className="num">{fmtNum(b.compras)}</td>
                        <td className="num">{fmtNum(b.invFinal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
