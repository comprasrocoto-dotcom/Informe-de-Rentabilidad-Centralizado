"use client";

import { Fragment } from "react";
import { useApp } from "@/components/Contexto";
import { BarraFiltros } from "@/components/BarraFiltros";
import { Encabezado } from "@/components/Encabezado";
import { GraficoBarras, GraficoLinea } from "@/components/Graficos";
import { DetalleExcluidas, notaConteo, notaMV, PctMeta, Tarjeta } from "@/components/Indicadores";
import { fmtM, fmtMes, fmtNum, fmtPct, fmtPesos } from "@/lib/formato";
import { cifras, type Bloque } from "@/lib/rentabilidad";
import { useCostos } from "@/lib/useCostos";

function AvisoConteo({ b }: { b: Bloque }) {
  const falta = [b.cocina, b.bar].some((c) => c.ventas !== 0 && !c.completo);
  if (!falta) return null;
  return (
    <span className="ml-2 rounded bg-alerta-suave px-1.5 py-0.5 text-[11px] font-medium text-alerta" title="Falta el conteo inicial o final de inventario: la mercancía vendida se tomó solo de las compras.">
      Solo compras
    </span>
  );
}

export default function Resumen() {
  const { filtros, marcas, meta } = useApp();
  const { cargando, error, total, porMes, porMesSede, produccion, sedePorId } = useCostos();
  const cc = filtros.cc;
  const marcaPorId = new Map(marcas.map((m) => [m.id, m.nombre]));
  const c = cifras(total, cc);

  const nombreSede = (id: number) => {
    const s = sedePorId.get(id);
    if (!s) return `Sede ${id}`;
    return filtros.marcaId == null ? `${marcaPorId.get(s.marca_id) ?? ""} · ${s.nombre}` : s.nombre;
  };

  const ultimo = porMes[porMes.length - 1];
  const penultimo = porMes[porMes.length - 2];
  const pU = ultimo ? cifras(ultimo[1], cc).pct : null;
  const pP = penultimo ? cifras(penultimo[1], cc).pct : null;
  const variacion = pU != null && pP != null ? (pU - pP) * 100 : null;
  const sobreMeta = c.pct != null && c.pct > meta;
  const hayTraslados = porMes.some(([, b]) => cifras(b, cc).traslados !== 0);

  return (
    <div>
      <Encabezado
        titulo="Resumen de rentabilidad"
        descripcion={<>Mercancía vendida = inventario inicial + compras de Cocina y Bar − inventario final. Costo = mercancía vendida ÷ ventas base. Meta: {fmtPct(meta)} como máximo.</>}
      />
      <BarraFiltros />
      {error && <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {cargando ? (
        <p className="text-sm text-texto-2">Cargando…</p>
      ) : porMes.length === 0 ? (
        <div className="tarjeta text-sm text-texto-2">
          No hay datos para este filtro. Sube los informes en <a className="font-medium text-marca underline" href="/cargar">Cargar datos</a>.
        </div>
      ) : (
        <>
          <div className="mb-3 grid gap-3 lg:grid-cols-[1.3fr_2fr]">
            <div
              className="relative overflow-hidden rounded border bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
              style={{ borderColor: sobreMeta ? "#d32f2f55" : "#2e7d3255", borderTop: `5px solid ${sobreMeta ? "#d32f2f" : "#2e7d32"}`, backgroundImage: `linear-gradient(135deg, ${sobreMeta ? "#d32f2f1f" : "#2e7d321f"} 0%, #ffffff 65%)` }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-bold tracking-wide uppercase" style={{ color: sobreMeta ? "#b71c1c" : "#1b5e20" }}>
                  Costo de mercancía vendida {cc !== "todos" ? `· ${cc}` : "· global"}
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white ${sobreMeta ? "bg-alerta" : "bg-bien"}`}>
                  {sobreMeta ? "Sobre la meta" : "En meta"}
                </span>
              </div>
              <div className={`mt-1 text-[48px] leading-none font-bold tracking-tight tabular-nums ${sobreMeta ? "text-alerta" : "text-bien"}`}>{fmtPct(c.pct)}</div>
              <div className="mt-2 text-xs text-texto-2">
                {sobreMeta ? `Por encima de la meta de ${fmtPct(meta)}` : `Dentro de la meta de ${fmtPct(meta)}`}
                {variacion != null && (
                  <>
                    {" · "}
                    <span className={variacion > 0 ? "font-medium text-alerta" : "font-medium text-bien"}>
                      {variacion > 0 ? "▲" : "▼"} {Math.abs(variacion).toLocaleString("es-CO", { maximumFractionDigits: 1 })} pts
                    </span>{" "}
                    en {fmtMes(ultimo[0])} frente a {fmtMes(penultimo[0])}
                  </>
                )}
              </div>
              {cc === "todos" && (
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-linea pt-3">
                  {(["Cocina", "Bar"] as const).map((x) => {
                    const cx = cifras(total, x);
                    return (
                      <div key={x} className="rounded border border-linea bg-white/80 px-3 py-2" style={{ borderLeft: `4px solid ${x === "Cocina" ? "#ef6c00" : "#8e24aa"}` }}>
                        <div className="text-[11px] font-bold tracking-wide uppercase" style={{ color: x === "Cocina" ? "#a84300" : "#6a1b9a" }}>{x}</div>
                        <div className="text-lg font-semibold tabular-nums"><PctMeta pct={cx.pct} meta={meta} /></div>
                        <div className="text-[11px] text-texto-3">{fmtM(cx.mv)} sobre {fmtM(cx.ventasBase)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-3 border-t border-linea pt-2 text-[11px] text-texto-3">Cálculo: {notaMV(c)}</div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Tarjeta titulo="Ventas totales" valor={fmtM(c.ventasTot)} exacto={fmtPesos(c.ventasTot)} nota="Base neta: sin IVA ni propinas" />
              <Tarjeta titulo="Mercancía vendida" valor={fmtM(c.mv)} exacto={fmtPesos(c.mv)} nota={notaMV(c)} />
              <Tarjeta
                titulo="Utilidad bruta" valor={fmtM(c.utilidad)} exacto={fmtPesos(c.utilidad)}
                nota={`${fmtPct(c.pctUtil)} sobre las ventas`} tono={c.utilidad < 0 ? "alerta" : undefined}
              />
              <Tarjeta titulo="Inventario inicial" valor={fmtM(c.invIni)} exacto={fmtPesos(c.invIni)} nota={notaConteo(c, "ini")} />
              <Tarjeta titulo={`Compras ${cc === "todos" ? "Cocina + Bar" : cc}`} valor={fmtM(c.compras + c.traslados)} exacto={fmtPesos(c.compras + c.traslados)} nota={c.traslados ? `Incluye traslados por ${fmtM(c.traslados)}` : "Solo centros de costo Cocina y Bar"} />
              <Tarjeta titulo="Inventario final" valor={fmtM(c.invFin)} exacto={fmtPesos(c.invFin)} nota={notaConteo(c, "fin")} />
            </div>
          </div>

          <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_1fr_0.9fr]">
            <GraficoBarras titulo="Ventas base por mes" datos={porMes.map(([m, b]) => ({ etiqueta: fmtMes(m), valor: cifras(b, cc).ventasBase }))} />
            <GraficoLinea titulo="% Costo de mercancía vendida por mes" meta={meta} datos={porMes.map(([m, b]) => ({ etiqueta: fmtMes(m), valor: cifras(b, cc).pct }))} />
            {cc === "todos" ? <DetalleExcluidas c={c} /> : (
              <Tarjeta titulo={`Ventas ${cc}`} valor={fmtM(c.ventasBase)} exacto={fmtPesos(c.ventasBase)} nota="Con el filtro de centro de costo no se calculan ventas excluidas." />
            )}
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
                    <th className="num">Ventas base</th>
                    <th className="num">Excluidas</th>
                    <th className="num">Inv. inicial</th>
                    <th className="num">Compras</th>
                    {hayTraslados && <th className="num">Traslados</th>}
                    <th className="num">Inv. final</th>
                    <th className="num">Mercancía vendida</th>
                    <th className="num">% Costo</th>
                    {cc === "todos" && <th className="num">% Cocina</th>}
                    {cc === "todos" && <th className="num">% Bar</th>}
                    <th className="num">Utilidad bruta</th>
                  </tr>
                </thead>
                <tbody>
                  {porMes.map(([mes, bm]) => {
                    const cm = cifras(bm, cc);
                    return (
                      <Fragment key={mes}>
                        <tr className="grupo">
                          <td className="capitalize">{fmtMes(mes)}</td>
                          <td className="num">{fmtNum(cm.ventasBase)}</td>
                          <td className="num">{fmtNum(cm.excluidas)}</td>
                          <td className="num">{fmtNum(cm.invIni)}</td>
                          <td className="num">{fmtNum(cm.compras)}</td>
                          {hayTraslados && <td className="num">{fmtNum(cm.traslados)}</td>}
                          <td className="num">{fmtNum(cm.invFin)}</td>
                          <td className="num">{fmtNum(cm.mv)}</td>
                          <td className="num"><PctMeta pct={cm.pct} meta={meta} /></td>
                          {cc === "todos" && <td className="num"><PctMeta pct={cifras(bm, "Cocina").pct} meta={meta} /></td>}
                          {cc === "todos" && <td className="num"><PctMeta pct={cifras(bm, "Bar").pct} meta={meta} /></td>}
                          <td className="num">{fmtNum(cm.utilidad)}</td>
                        </tr>
                        {porMesSede.filter((x) => x.mes === mes).map(({ sedeId, b }) => {
                          const cs = cifras(b, cc);
                          return (
                            <tr key={`${mes}-${sedeId}`}>
                              <td className="pl-6 text-texto-2">{nombreSede(sedeId)}<AvisoConteo b={b} /></td>
                              <td className="num">{fmtNum(cs.ventasBase)}</td>
                              <td className="num text-texto-3">{fmtNum(cs.excluidas)}</td>
                              <td className="num">{fmtNum(cs.invIni)}</td>
                              <td className="num">{fmtNum(cs.compras)}</td>
                              {hayTraslados && <td className="num">{fmtNum(cs.traslados)}</td>}
                              <td className="num">{fmtNum(cs.invFin)}</td>
                              <td className="num">{fmtNum(cs.mv)}</td>
                              <td className="num"><PctMeta pct={cs.pct} meta={meta} /></td>
                              {cc === "todos" && <td className="num"><PctMeta pct={cifras(b, "Cocina").pct} meta={meta} /></td>}
                              {cc === "todos" && <td className="num"><PctMeta pct={cifras(b, "Bar").pct} meta={meta} /></td>}
                              <td className="num">{fmtNum(cs.utilidad)}</td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
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
                    {produccion.map(({ mes, sedeId, b }) => {
                      const cp = cifras(b, cc);
                      return (
                        <tr key={`${mes}-${sedeId}`}>
                          <td><span className="capitalize">{fmtMes(mes)}</span> · {nombreSede(sedeId)}</td>
                          <td className="num">{fmtNum(cp.invIni)}</td>
                          <td className="num">{fmtNum(cp.compras)}</td>
                          <td className="num">{fmtNum(cp.invFin)}</td>
                        </tr>
                      );
                    })}
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
