"use client";

import { useState } from "react";
import { useApp } from "@/components/Contexto";
import { Encabezado } from "@/components/Encabezado";
import { GraficoSeries } from "@/components/Graficos";
import { useCP } from "@/components/cp/ContextoCP";
import { COLOR_MARCA, NavCP } from "@/components/cp/NavCP";
import { Aviso, BarrasMarca, fmtKg, Kpi, Seccion } from "@/components/cp/Comunes";
import { fmtNum, fmtPesos } from "@/lib/formato";
import { etiquetaMes, participacionKilos, pctEfectivo, sum } from "@/lib/cp/motorCP";

function Informes() {
  const { datos: d, conv } = useCP();
  const meses = [...new Set(d.fab.map((f) => f.mes))].sort();
  if (!meses.length) return null;
  const porMes = meses.map((m) => ({ mes: m, ...participacionKilos(d.fab.filter((f) => f.mes === m), conv.aKg) }));
  const datos = porMes.map((p) => ({ etiqueta: etiquetaMes(p.mes), sa: Math.round(p.kgSA), ro: Math.round(p.kgRO) }));
  const series = [{ clave: "sa", nombre: "San Agustín", color: COLOR_MARCA["San Agustín"] }, { clave: "ro", nombre: "Rocoto", color: COLOR_MARCA.Rocoto }];
  const delta = (a: number, b?: number) => (b ? ((a - b) / b) * 100 : null);
  const fmtD = (x: number | null) => (x === null ? <span className="text-texto-3">—</span> : <span className={x >= 0 ? "text-bien" : "text-alerta"}>{x >= 0 ? "+" : ""}{x.toFixed(1)}%</span>);
  return (
    <>
      <div className="mb-5 grid gap-3 lg:grid-cols-2">
        <GraficoSeries titulo="Participación en kilos por mes y marca" datos={datos} series={series} formato={(v) => `${fmtNum(v)} kg`} />
        <GraficoSeries titulo="Evolución de kilos fabricados por marca" tipo="lineas" datos={datos} series={series} formato={(v) => `${fmtNum(v)} kg`} />
      </div>
      <Seccion titulo="Kilos fabricados por mes" nota="Solo filas convertibles a kilos. Un mes sin filas de una marca no es “bajó a 0”: revisa la cobertura en Resumen global.">
        <table className="tabla">
          <thead><tr><th>Mes</th><th className="num">Kg San Agustín</th><th className="num">Δ vs mes anterior</th><th className="num">Kg Rocoto</th><th className="num">Δ vs mes anterior</th><th className="num">% SA / % RO</th></tr></thead>
          <tbody>
            {porMes.map((p, i) => (
              <tr key={p.mes}>
                <td>{etiquetaMes(p.mes)}</td>
                <td className="num">{fmtKg(p.kgSA)}</td><td className="num">{fmtD(i ? delta(p.kgSA, porMes[i - 1].kgSA) : null)}</td>
                <td className="num">{fmtKg(p.kgRO)}</td><td className="num">{fmtD(i ? delta(p.kgRO, porMes[i - 1].kgRO) : null)}</td>
                <td className="num">{p.pctSA ?? "—"}% / {p.pctRO ?? "—"}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Seccion>
    </>
  );
}

export default function Liquidacion() {
  const { sb } = useApp();
  const { datos: d, filtro, conv, recargar, cargando } = useCP();
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const mes = filtro.mes;

  async function guardarPct(v: number) {
    const pct = Math.max(0, Math.min(100, v));
    setGuardando(true);
    const { error } = await sb.from("cp_reparto_manual").upsert({ mes, pct_san_agustin: pct, actualizado: new Date().toISOString() });
    setGuardando(false);
    setMsg(error ? error.message : `% manual guardado para ${etiquetaMes(mes)}: San Agustín ${pct}% / Rocoto ${Math.round((100 - pct) * 100) / 100}%.`);
    recargar();
  }
  async function quitarManual() {
    setGuardando(true);
    const { error } = await sb.from("cp_reparto_manual").delete().eq("mes", mes);
    setGuardando(false);
    setMsg(error ? error.message : "Se quitó el % manual: vuelve el automático por kilos.");
    recargar();
  }

  const encabezado = <Encabezado titulo="Liquidación San Agustín vs Rocoto" descripcion="Los costos compartidos del CP (nómina, servicios, mantenimiento) se reparten según la participación en kilos fabricados de cada marca en el mes." />;
  if (cargando) return <div>{encabezado}<NavCP /><p className="text-sm text-texto-2">Cargando…</p></div>;
  if (mes === "Todos") {
    return (
      <div>{encabezado}<NavCP />
        <Aviso tono="vacio">Selecciona un mes específico arriba para ver el reparto: el % de kilos se define mes a mes, no como total acumulado.</Aviso>
        <Informes />
      </div>
    );
  }

  const tot = sum(d.costos.filter((c) => c.mes === mes), (c) => c.valor);
  const p = pctEfectivo(d, mes, conv.aKg);
  const kg = participacionKilos(d.fab.filter((f) => f.mes === mes), conv.aKg);

  return (
    <div>{encabezado}<NavCP />
      {msg && <p className="mb-4 rounded-sm bg-marca-suave p-3 text-sm text-texto">{msg}</p>}
      <Seccion titulo={`Reparto de costos compartidos · ${etiquetaMes(mes)}`}>
        <div className="p-4">
          {tot === 0 ? (
            <Aviso tono="vacio"><b>No hay costos compartidos cargados para {etiquetaMes(mes)}.</b> Es el único valor que se reparte entre marcas; agrégalo en la hoja Costos_Compartidos_CP y súbelo, o en <b>Cargar archivo → Costos compartidos</b>.</Aviso>
          ) : p.sa === null ? (
            <Aviso tono="vacio">{kg.marcaSinDatos ? `${kg.marcaSinDatos} no tiene fabricación en ${etiquetaMes(mes)}, así que no hay % automático.` : `No hay filas de fabricación convertibles a kilos en ${etiquetaMes(mes)}.`} Ingresa el % manual abajo.</Aviso>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Kpi titulo="Total a repartir" valor={fmtPesos(tot)} />
              <Kpi titulo={`San Agustín (${p.sa}%)`} valor={fmtPesos((tot * p.sa) / 100)} />
              <Kpi titulo={`Rocoto (${p.ro}%)`} valor={fmtPesos((tot * (p.ro ?? 0)) / 100)} />
            </div>
          )}
          {p.sa !== null && <p className="mt-2 text-xs text-texto-3">{p.origen === "manual" ? `Manual: ingresado el ${new Date(p.manual!.actualizado).toLocaleDateString("es-CO")}` : "Automático: participación en kilos fabricados, sin ajuste manual"}</p>}
        </div>
      </Seccion>

      <Seccion titulo={`% de kilos preparados · ${etiquetaMes(mes)}`} nota={p.origen === "manual" ? "Anulado manualmente" : "Usando el automático"}>
        <div className="space-y-3 p-4 text-sm">
          <BarrasMarca sa={kg.kgSA} ro={kg.kgRO} formato={fmtKg} pct={[kg.pctSA, kg.pctRO]} />
          <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); const v = Number(new FormData(e.currentTarget).get("pct")); if (!isNaN(v)) guardarPct(v); }}>
            <label><span className="etiqueta">% San Agustín</span>
              <input name="pct" key={`${mes}-${p.sa}`} type="number" min={0} max={100} step={0.01} defaultValue={p.sa ?? 50} className="campo w-28 text-right" />
            </label>
            <button className="boton" disabled={guardando}>Guardar % manual</button>
            {p.origen === "manual" && <button type="button" className="boton-sec" disabled={guardando} onClick={quitarManual}>Quitar el manual y volver al automático</button>}
          </form>
          <p className="text-xs text-texto-2">
            {kg.marcaSinDatos ? <><b>{kg.marcaSinDatos} no tiene fabricación en {etiquetaMes(mes)}</b>: no hay % automático; lo que ingreses queda como manual.</>
              : kg.totalKg ? <>El automático es San Agustín {kg.pctSA}% / Rocoto {kg.pctRO}%, calculado sobre {fmtNum(kg.totalFilas - kg.sinConvN)} de {fmtNum(kg.totalFilas)} filas convertibles a kilos. Solo cámbialo si quieres anularlo para este mes. El % manual queda guardado para todos los usuarios.</>
              : <>No hay filas convertibles a kilos este mes: el % es 100 % manual.</>}
          </p>
        </div>
      </Seccion>
      <Informes />
    </div>
  );
}
