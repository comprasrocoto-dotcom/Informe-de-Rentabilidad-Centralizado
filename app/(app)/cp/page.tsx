"use client";

import { Encabezado } from "@/components/Encabezado";
import { useCP } from "@/components/cp/ContextoCP";
import { NavCP } from "@/components/cp/NavCP";
import { Aviso, BarrasMarca, Kpi, Seccion } from "@/components/cp/Comunes";
import { fmtNum, fmtPesos } from "@/lib/formato";
import { aplicar, etiquetaMes, MARCAS_CP, pctEfectivo, sum } from "@/lib/cp/motorCP";

export default function ResumenCP() {
  const { datos: d, filtro, cargando, error, conv } = useCP();
  const compras = aplicar(d.compras, filtro), fab = aplicar(d.fab, filtro), tras = aplicar(d.tras, filtro), inv = aplicar(d.inv, filtro);
  const costos = d.costos.filter((c) => filtro.mes === "Todos" || c.mes === filtro.mes);
  const totCostos = sum(costos, (r) => r.valor);
  const sinDatos = !d.compras.length && !d.fab.length && !d.tras.length && !d.inv.length;

  // Reparto de costos compartidos por mes (mismo % que Liquidación)
  const mesesReparto = [...new Set([...d.costos.map((c) => c.mes), ...d.fab.map((f) => f.mes)])].sort().filter((m) => filtro.mes === "Todos" || m === filtro.mes);
  // Cobertura: qué hojas traen datos de cada mes y marca
  const fuentes = [
    { label: "Compras", rows: d.compras }, { label: "Fabricación", rows: d.fab }, { label: "Traslados", rows: d.tras }, { label: "Inv. final", rows: d.inv },
  ];
  const mesesCob = [...new Set([...fuentes.flatMap((f) => f.rows.map((r) => r.mes)), ...d.costos.map((c) => c.mes)])].sort();

  return (
    <div>
      <Encabezado titulo="Centro de producción · Cierre de mes" descripcion="San Agustín (Centro de Producción) y Rocoto (Planta de Producción): compras, fabricación, traslados a sedes, inventarios y reparto de costos compartidos por kilos fabricados." />
      <NavCP />
      {error && <p className="mb-4 rounded-sm bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {cargando ? <p className="text-sm text-texto-2">Cargando…</p> : sinDatos ? (
        <Aviso tono="vacio">Aún no hay datos del Centro de producción. Sube el archivo de cierre en la pestaña <b>Cargar archivo</b> (hojas Compras, Fabricaciones, Traslados_Sedes, Inventario_CP, Base_Conversion y Costos_Compartidos_CP).</Aviso>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Kpi titulo="Compras CP" valor={fmtPesos(sum(compras, (r) => r.total))} sub={`${fmtNum(compras.length)} líneas`} />
            <Kpi titulo="Costo fabricación" valor={fmtPesos(sum(fab, (r) => r.costo))} sub={`${fmtNum(fab.length)} líneas`} />
            <Kpi titulo="Valor traslados" valor={fmtPesos(sum(tras, (r) => r.costo))} sub={`${fmtNum(tras.length)} líneas`} />
            <Kpi titulo="Costos compartidos" valor={totCostos ? fmtPesos(totCostos) : "Sin datos aún"} sub={`${costos.length} líneas`} vacio={!totCostos} />
            <Kpi titulo="Inventario valorizado" valor={fmtPesos(sum(inv, (r) => r.total))} sub={`${fmtNum(inv.length)} líneas`} />
          </div>

          <Seccion titulo="Reparto de costos compartidos por participación en kilos" nota="Costos compartidos repartidos según el % de kilos fabricados (Fabricación × Base de conversión), o el % manual del mes si existe.">
            <table className="tabla">
              <thead><tr><th>Mes</th><th className="num">Costos compartidos</th><th className="num">% San Agustín</th><th className="num">Le corresponde a SA</th><th className="num">% Rocoto</th><th className="num">Le corresponde a RO</th><th>% según</th></tr></thead>
              <tbody>
                {mesesReparto.length === 0 ? <tr><td colSpan={7} className="text-texto-3">Sin meses con Fabricación o Costos compartidos.</td></tr> : mesesReparto.map((m) => {
                  const tot = sum(d.costos.filter((c) => c.mes === m), (c) => c.valor);
                  const p = pctEfectivo(d, m, conv.aKg);
                  return (
                    <tr key={m}>
                      <td>{etiquetaMes(m)}</td>
                      <td className="num">{tot ? fmtPesos(tot) : <span className="text-texto-3">sin costos compartidos</span>}</td>
                      {!tot ? <td colSpan={5} className="num text-texto-3">—</td> : p.sa === null ? (
                        <td colSpan={5} className="text-texto-3">{p.kg.marcaSinDatos ? `${p.kg.marcaSinDatos} sin fabricación este mes` : "Sin % de kilos disponible"}: ingresa el % manual en Liquidación</td>
                      ) : (
                        <>
                          <td className="num">{p.sa}%</td><td className="num">{fmtPesos((tot * p.sa) / 100)}</td>
                          <td className="num">{p.ro}%</td><td className="num">{fmtPesos((tot * (p.ro ?? 0)) / 100)}</td>
                          <td>{p.origen === "manual" ? "Manual" : "Kilos fabricados"}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Seccion>

          <Seccion titulo="Compras por marca">
            <BarrasMarca sa={sum(compras.filter((r) => r.marca === "San Agustín"), (r) => r.total)} ro={sum(compras.filter((r) => r.marca === "Rocoto"), (r) => r.total)} />
          </Seccion>

          <Seccion titulo="Cobertura de datos por mes" nota="✓ = la hoja trae filas de ese mes y marca. Antes de leer una caída como real, revisa que el mes tenga datos.">
            <table className="tabla">
              <thead><tr><th>Fuente</th><th>Marca</th>{mesesCob.map((m) => <th key={m} className="num">{etiquetaMes(m)}</th>)}</tr></thead>
              <tbody>
                {fuentes.flatMap((f) => MARCAS_CP.map((marca) => (
                  <tr key={f.label + marca}>
                    <td>{f.label}</td><td>{marca}</td>
                    {mesesCob.map((m) => { const si = f.rows.some((r) => r.mes === m && r.marca === marca); return <td key={m} className={`num ${si ? "font-medium text-bien" : "text-texto-3"}`}>{si ? "✓" : "—"}</td>; })}
                  </tr>
                )))}
                <tr>
                  <td>Costos compartidos</td><td>Ambas</td>
                  {mesesCob.map((m) => { const si = d.costos.some((c) => c.mes === m); return <td key={m} className={`num ${si ? "font-medium text-bien" : "text-texto-3"}`}>{si ? "✓" : "—"}</td>; })}
                </tr>
              </tbody>
            </table>
          </Seccion>
        </>
      )}
    </div>
  );
}
