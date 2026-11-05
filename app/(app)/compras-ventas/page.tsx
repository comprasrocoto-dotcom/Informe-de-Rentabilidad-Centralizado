"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/Contexto";
import { BarraFiltros } from "@/components/BarraFiltros";
import { Encabezado } from "@/components/Encabezado";
import { GraficoSeries } from "@/components/Graficos";
import { Tarjeta } from "@/components/Indicadores";
import { fmtM, fmtMes, fmtPct, fmtPesos } from "@/lib/formato";
import { useCostos } from "@/lib/useCostos";
import { analizar, excesoAcumulado, type FilaCV, type Referencia, type Senal } from "@/lib/comprasVentas";
import { cifras, type FiltroCC } from "@/lib/rentabilidad";

const REFS: { v: Referencia; t: string; d: string }[] = [
  { v: "anterior", t: "Mes anterior", d: "Compara cada mes con el % de compra sobre venta del mes anterior" },
  { v: "promedio", t: "Promedio", d: "Compara con el % promedio de todos los meses anteriores" },
  { v: "meta", t: "Meta de costo", d: "Compara con la meta de costo de la marca" },
];
const COLOR_SENAL: Record<Senal, string> = {
  "de más": "bg-[#ffebee] text-alerta", "de menos": "bg-[#e3f2fd] text-tinta", "en línea": "bg-[#e8f5e9] text-bien", "sin referencia": "bg-fondo text-texto-3",
};
const TEXTO_SENAL: Record<Senal, string> = { "de más": "Compró de más", "de menos": "Compró de menos", "en línea": "En línea", "sin referencia": "Sin referencia" };
const pts = (x: number | null) => (x == null ? "—" : `${x > 0 ? "+" : ""}${(x * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} pts`);
const varTxt = (x: number | null) => (x == null ? "—" : `${x > 0 ? "▲" : x < 0 ? "▼" : ""} ${fmtPct(Math.abs(x))}`);
const NOMBRE_CC: Record<FiltroCC, string> = { todos: "Total Cocina + Bar", Cocina: "Cocina", Bar: "Bar" };

function Senalar({ s }: { s: Senal }) {
  return <span className={`inline-block rounded-sm px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${COLOR_SENAL[s]}`}>{TEXTO_SENAL[s]}</span>;
}

function TablaMeses({ cc, filas }: { cc: FiltroCC; filas: FilaCV[] }) {
  return (
    <div className="tarjeta mb-4 overflow-hidden !p-0">
      <div className="flex items-baseline justify-between gap-3 px-4 pt-3 pb-2">
        <h2 className="text-sm font-semibold text-tinta">{NOMBRE_CC[cc]} · mes a mes</h2>
        <span className="text-xs text-texto-3">Compra de más acumulada: <b className="text-alerta">{fmtPesos(excesoAcumulado(filas))}</b></span>
      </div>
      <div className="overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              <th>Mes</th><th className="num">Ventas</th><th className="num">Var. ventas</th><th className="num">Compras</th><th className="num">Var. compras</th>
              <th className="num">% compra / venta</th><th className="num">% referencia</th><th className="num">Cambio</th>
              <th className="num">Compra esperada</th><th className="num">Diferencia</th><th className="num">Variación inventario</th><th>Señal</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.mes}>
                <td className="font-medium">{fmtMes(f.mes)}</td>
                <td className="num">{fmtPesos(f.ventas)}</td>
                <td className={`num ${f.varVentas != null && f.varVentas < 0 ? "text-alerta" : "text-bien"}`}>{varTxt(f.varVentas)}</td>
                <td className="num" title={f.traslados ? `Incluye traslados por ${fmtPesos(f.traslados)}` : undefined}>{fmtPesos(f.compras)}</td>
                <td className={`num ${f.varCompras != null && f.varVentas != null && f.varCompras > f.varVentas ? "font-medium text-alerta" : ""}`}>{varTxt(f.varCompras)}</td>
                <td className="num font-semibold">{fmtPct(f.pct)}</td>
                <td className="num text-texto-2">{fmtPct(f.pctRef)}</td>
                <td className={`num ${(f.deltaPts ?? 0) > 0 ? "text-alerta" : "text-bien"}`}>{pts(f.deltaPts)}</td>
                <td className="num text-texto-2">{f.esperada == null ? "—" : fmtPesos(f.esperada)}</td>
                <td className={`num font-semibold ${(f.diferencia ?? 0) > 0 ? "text-alerta" : "text-bien"}`}>{f.diferencia == null ? "—" : `${f.diferencia > 0 ? "+" : ""}${fmtPesos(f.diferencia)}`}</td>
                <td className="num text-texto-2" title="Inv. final − Inv. inicial del mes">{f.deltaInv == null ? "sin conteos" : `${f.deltaInv > 0 ? "+" : ""}${fmtPesos(f.deltaInv)}`}</td>
                <td><Senalar s={f.senal} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ComprasVentas() {
  const { filtros, meta } = useApp();
  const cc = filtros.cc as FiltroCC;
  const [ref, setRef] = useState<Referencia>("anterior");
  const [umbralPts, setUmbralPts] = useState(2);
  const umbral = umbralPts / 100;
  // Se trae un mes extra antes de "Desde" para poder comparar el primer mes del filtro
  const { cargando, error, porMes, porMesSede, sedePorId } = useCostos(1);
  const desdeMes = (filtros.desde || "").slice(0, 7);

  const ccs: FiltroCC[] = cc === "todos" ? ["todos", "Cocina", "Bar"] : [cc];
  const porCC = useMemo(() => Object.fromEntries(ccs.map((x) => [x, analizar(porMes, x, ref, meta, umbral, desdeMes)])) as Record<FiltroCC, FilaCV[]>,
    [porMes, ref, meta, umbral, desdeMes, cc]); // eslint-disable-line react-hooks/exhaustive-deps
  const foco = porCC[cc] ?? [];
  const ult = foco[foco.length - 1];
  const mesesVista = foco.map((f) => f.mes);
  const [mesSede, setMesSede] = useState<string>("");
  const mesS = mesSede && mesesVista.includes(mesSede) ? mesSede : ult?.mes ?? "";

  // Por sede para el mes elegido, contra la misma sede el mes anterior (o la referencia elegida)
  const sedesFilas = useMemo(() => {
    if (!mesS) return [];
    const ids = [...new Set(porMesSede.map((x) => x.sedeId))];
    return ids.map((id) => {
      const meses = porMesSede.filter((x) => x.sedeId === id).sort((a, b) => a.mes.localeCompare(b.mes)).map((x) => [x.mes, x.b] as [string, typeof x.b]);
      const f = analizar(meses, cc, ref, meta, umbral).find((x) => x.mes === mesS);
      return f ? { sede: sedePorId.get(id)?.nombre ?? `Sede ${id}`, f } : null;
    }).filter((x): x is { sede: string; f: FilaCV } => !!x && (x.f.ventas !== 0 || x.f.compras !== 0))
      .sort((a, b) => (b.f.diferencia ?? -Infinity) - (a.f.diferencia ?? -Infinity));
  }, [porMesSede, mesS, cc, ref, meta, umbral, sedePorId]);

  const graf1 = foco.map((f) => ({ etiqueta: fmtMes(f.mes), ventas: f.ventas, compras: f.compras, esperada: f.esperada }));
  const graf2 = porMes.filter(([m]) => m >= desdeMes).map(([m, b]) => {
    const p = (x: FiltroCC) => { const c = cifras(b, x); return c.ventasBase ? (c.compras + c.traslados) / c.ventasBase : null; };
    return { etiqueta: fmtMes(m), total: p("todos"), cocina: p("Cocina"), bar: p("Bar") };
  });

  return (
    <div>
      <Encabezado
        titulo="Compras vs ventas"
        descripcion={<>Mes a mes por centro de costo: cuánto variaron las compras y si, para lo que se vendió, se compró más de lo que se debía. <b>Compra esperada</b> = ventas del mes × % de compra sobre venta de referencia. <b>Diferencia</b> positiva = se compró de más. Las compras incluyen los traslados recibidos.</>}
      />
      <BarraFiltros />

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <span className="etiqueta">Comparar contra</span>
          <div className="flex h-9 overflow-hidden rounded-sm border border-linea bg-white text-sm" role="group">
            {REFS.map((r) => (
              <button key={r.v} type="button" title={r.d} aria-pressed={ref === r.v} onClick={() => setRef(r.v)}
                className={`px-3 ${ref === r.v ? "bg-marca font-medium text-white" : "text-texto hover:bg-marca-suave"} border-r border-linea last:border-r-0`}>{r.t}{r.v === "meta" ? ` (${fmtPct(meta)})` : ""}</button>
            ))}
          </div>
        </div>
        <label>
          <span className="etiqueta">Tolerancia</span>
          <select className="campo w-44" value={umbralPts} onChange={(e) => setUmbralPts(Number(e.target.value))}>
            {[1, 2, 3, 5].map((n) => <option key={n} value={n}>± {n} puntos</option>)}
          </select>
        </label>
        <p className="max-w-xl pb-1 text-xs text-texto-3">Un mes se marca &quot;Compró de más&quot; cuando su % de compra sobre venta supera la referencia en más puntos que la tolerancia.</p>
      </div>

      {error && <p className="mb-4 text-sm text-alerta">{error}</p>}
      {cargando ? <p className="text-sm text-texto-2">Cargando…</p> : !foco.length ? <p className="text-sm text-texto-2">No hay datos para este filtro.</p> : (
        <>
          {ult && (
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Tarjeta titulo={`Ventas ${fmtMes(ult.mes)}`} valor={fmtM(ult.ventas)} exacto={fmtPesos(ult.ventas)} nota={`${varTxt(ult.varVentas)} frente al mes anterior`} />
              <Tarjeta titulo={`Compras ${fmtMes(ult.mes)}`} valor={fmtM(ult.compras)} exacto={fmtPesos(ult.compras)} nota={`${varTxt(ult.varCompras)} frente al mes anterior`} />
              <Tarjeta titulo="% compra sobre venta" valor={fmtPct(ult.pct)} nota={`Referencia ${fmtPct(ult.pctRef)} · ${pts(ult.deltaPts)}`} tono={ult.senal === "de más" ? "alerta" : ult.senal === "en línea" ? "bien" : undefined} />
              <Tarjeta titulo={`Diferencia de compra ${fmtMes(ult.mes)}`} valor={ult.diferencia == null ? "—" : `${ult.diferencia > 0 ? "+" : ""}${fmtM(ult.diferencia)}`} exacto={ult.esperada == null ? undefined : `Esperada ${fmtPesos(ult.esperada)}`} nota={`${TEXTO_SENAL[ult.senal]} (tolerancia ± ${umbralPts} pts)`} tono={ult.senal === "de más" ? "alerta" : ult.senal === "sin referencia" ? undefined : "bien"} />
              <Tarjeta titulo="Compra de más acumulada" valor={fmtM(excesoAcumulado(foco))} exacto={fmtPesos(excesoAcumulado(foco))} nota={`${NOMBRE_CC[cc]} · suma de los meses marcados "Compró de más"`} tono={excesoAcumulado(foco) > 0 ? "alerta" : "bien"} />
            </div>
          )}

          <div className="mb-4 grid gap-3 lg:grid-cols-2">
            <GraficoSeries titulo={`Ventas, compras y compra esperada · ${NOMBRE_CC[cc]}`} datos={graf1}
              series={[{ clave: "ventas", nombre: "Ventas", color: "#1976d2" }, { clave: "compras", nombre: "Compras", color: "#eb6834" }, { clave: "esperada", nombre: "Compra esperada", color: "#1baf7a" }]} />
            <GraficoSeries titulo="% de compra sobre venta por centro de costo" tipo="lineas" formato={(v) => fmtPct(v)} datos={graf2}
              series={[{ clave: "total", nombre: "Total", color: "#1976d2" }, { clave: "cocina", nombre: "Cocina", color: "#eb6834" }, { clave: "bar", nombre: "Bar", color: "#1baf7a" }]} />
          </div>

          {ccs.map((x) => <TablaMeses key={x} cc={x} filas={porCC[x] ?? []} />)}

          <div className="tarjeta overflow-hidden !p-0">
            <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-3 pb-2">
              <div>
                <h2 className="text-sm font-semibold text-tinta">Por sede · {NOMBRE_CC[cc]}</h2>
                <p className="text-xs text-texto-3">Quién compró de más en el mes, ordenado de mayor a menor diferencia. Cada sede se compara consigo misma.</p>
              </div>
              <label><span className="etiqueta">Mes</span>
                <select className="campo w-40" value={mesS} onChange={(e) => setMesSede(e.target.value)}>
                  {mesesVista.map((m) => <option key={m} value={m}>{fmtMes(m)}</option>)}
                </select>
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="tabla">
                <thead><tr><th>Sede</th><th className="num">Ventas</th><th className="num">Var. ventas</th><th className="num">Compras</th><th className="num">Var. compras</th><th className="num">% compra / venta</th><th className="num">% referencia</th><th className="num">Compra esperada</th><th className="num">Diferencia</th><th>Señal</th></tr></thead>
                <tbody>
                  {sedesFilas.map(({ sede, f }) => (
                    <tr key={sede}>
                      <td className="font-medium">{sede}</td>
                      <td className="num">{fmtPesos(f.ventas)}</td>
                      <td className={`num ${f.varVentas != null && f.varVentas < 0 ? "text-alerta" : "text-bien"}`}>{varTxt(f.varVentas)}</td>
                      <td className="num">{fmtPesos(f.compras)}</td>
                      <td className={`num ${f.varCompras != null && f.varVentas != null && f.varCompras > f.varVentas ? "font-medium text-alerta" : ""}`}>{varTxt(f.varCompras)}</td>
                      <td className="num font-semibold">{fmtPct(f.pct)}</td>
                      <td className="num text-texto-2">{fmtPct(f.pctRef)}</td>
                      <td className="num text-texto-2">{f.esperada == null ? "—" : fmtPesos(f.esperada)}</td>
                      <td className={`num font-semibold ${(f.diferencia ?? 0) > 0 ? "text-alerta" : "text-bien"}`}>{f.diferencia == null ? "—" : `${f.diferencia > 0 ? "+" : ""}${fmtPesos(f.diferencia)}`}</td>
                      <td><Senalar s={f.senal} /></td>
                    </tr>
                  ))}
                  {!sedesFilas.length && <tr><td colSpan={10} className="text-texto-3">Sin datos de sedes para este mes.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-3 text-xs text-texto-3">
            Variación inventario = inventario final − inicial del mes. Si un mes compró de más pero el inventario subió en una cifra parecida, lo comprado de más quedó guardado y no se perdió; si el inventario no subió, se consumió (revisar mermas, porciones o precios).
          </p>
        </>
      )}
    </div>
  );
}
