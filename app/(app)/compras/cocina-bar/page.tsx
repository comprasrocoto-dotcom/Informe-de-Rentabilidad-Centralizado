"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/Contexto";
import { BarraFiltros } from "@/components/BarraFiltros";
import { Encabezado } from "@/components/Encabezado";
import { GraficoSeries } from "@/components/Graficos";
import { PestanasCompras } from "@/components/PestanasCompras";
import { TarjetaColor, TEMAS } from "@/components/TarjetaColor";
import { fmtDec, fmtM, fmtMes, fmtNum, fmtPct, fmtPesos } from "@/lib/formato";

// Informe de compras de Cocina y Bar: los dos centros de costo lado a lado, mes a mes y por proveedor,
// familia, artículo o sede. Datos de la función compras_cocina_bar (respeta el acceso por marca).

type Fila = { k: string; m: string; cc: "Cocina" | "Bar"; t: number; u: number; d: number };
type Dim = "proveedor" | "familia" | "articulo" | "sede";
type CC = "Ambos" | "Cocina" | "Bar";
const DIMS: { v: Dim; t: string }[] = [
  { v: "proveedor", t: "Proveedor" }, { v: "familia", t: "Familia" }, { v: "articulo", t: "Artículo" }, { v: "sede", t: "Sede" },
];
const COLOR = { Cocina: "#eb6834", Bar: "#8e24aa" };
const varPct = (a: number, b: number | undefined) => (b ? (a - b) / Math.abs(b) : null);
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Var({ v, invertir = false }: { v: number | null; invertir?: boolean }) {
  if (v == null) return <span className="text-texto-3">—</span>;
  const malo = invertir ? v < 0 : v > 0; // en compras, subir es lo que hay que mirar
  return <span className={`font-medium ${malo ? "text-alerta" : "text-bien"}`}>{v > 0 ? "▲" : v < 0 ? "▼" : ""} {fmtPct(Math.abs(v))}</span>;
}

export default function ComprasCocinaBar() {
  const { sb, filtros } = useApp();
  const [porMes, setPorMes] = useState<Fila[]>([]);
  const [porDim, setPorDim] = useState<Fila[]>([]);
  const [dim, setDim] = useState<Dim>("proveedor");
  const [vista, setVista] = useState<"comparar" | "mensual">("comparar");
  const [ccMes, setCcMes] = useState<CC>("Ambos");
  const [q, setQ] = useState("");
  const [limite, setLimite] = useState(100);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const args = useMemo(() => ({ p_marca: filtros.marcaId, p_sede: filtros.sedeId, p_desde: filtros.desde || null, p_hasta: filtros.hasta || null }),
    [filtros.marcaId, filtros.sedeId, filtros.desde, filtros.hasta]);
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    sb.rpc("compras_cocina_bar", { p_dim: "mes", ...args }).then(({ data, error }) => {
      if (!vivo) return;
      setError(error?.message ?? null); setPorMes(((data as Fila[]) ?? []).map((f) => ({ ...f, t: Number(f.t), u: Number(f.u) })));
    });
    return () => { vivo = false; };
  }, [sb, args]);
  useEffect(() => {
    let vivo = true;
    setCargando(true); setLimite(100);
    sb.rpc("compras_cocina_bar", { p_dim: dim, ...args }).then(({ data, error }) => {
      if (!vivo) return;
      if (error) setError(error.message);
      setPorDim(((data as Fila[]) ?? []).map((f) => ({ ...f, t: Number(f.t), u: Number(f.u) })));
      setCargando(false);
    });
    return () => { vivo = false; };
  }, [sb, args, dim]);

  const meses = useMemo(() => [...new Set(porMes.map((f) => f.m))].sort(), [porMes]);
  const ult = meses[meses.length - 1], ant = meses[meses.length - 2];

  // Resumen mensual Cocina / Bar
  const mensual = meses.map((m, i) => {
    const c = porMes.find((f) => f.m === m && f.cc === "Cocina"), b = porMes.find((f) => f.m === m && f.cc === "Bar");
    const pc = meses[i - 1] ? porMes.find((f) => f.m === meses[i - 1] && f.cc === "Cocina") : undefined;
    const pb = meses[i - 1] ? porMes.find((f) => f.m === meses[i - 1] && f.cc === "Bar") : undefined;
    const cocina = c?.t ?? 0, bar = b?.t ?? 0, total = cocina + bar;
    return { m, cocina, bar, total, docs: (c?.d ?? 0) + (b?.d ?? 0),
      vC: i ? varPct(cocina, pc?.t ?? 0) : null, vB: i ? varPct(bar, pb?.t ?? 0) : null, vT: i ? varPct(total, (pc?.t ?? 0) + (pb?.t ?? 0)) : null };
  });
  const totC = mensual.reduce((a, x) => a + x.cocina, 0), totB = mensual.reduce((a, x) => a + x.bar, 0), tot = totC + totB;
  const fU = mensual[mensual.length - 1];

  // Tabla por dimensión
  const filasDim = useMemo(() => {
    const m = new Map<string, { k: string; cocina: number; bar: number; uC: number; uB: number; mes: Record<string, number>; ult: number; ant: number; uUlt: number; uAnt: number }>();
    for (const f of porDim) {
      if (ccMes !== "Ambos" && vista === "mensual" && f.cc !== ccMes) continue;
      const o = m.get(f.k) ?? { k: f.k, cocina: 0, bar: 0, uC: 0, uB: 0, mes: {}, ult: 0, ant: 0, uUlt: 0, uAnt: 0 };
      if (f.cc === "Cocina") { o.cocina += f.t; o.uC += f.u; } else { o.bar += f.t; o.uB += f.u; }
      o.mes[f.m] = (o.mes[f.m] ?? 0) + f.t;
      if (f.m === ult) { o.ult += f.t; o.uUlt += f.u; }
      if (f.m === ant) { o.ant += f.t; o.uAnt += f.u; }
      m.set(f.k, o);
    }
    let r = [...m.values()].sort((a, b) => b.cocina + b.bar - (a.cocina + a.bar));
    if (q) { const n = norm(q); r = r.filter((x) => norm(x.k).includes(n)); }
    return r;
  }, [porDim, q, ult, ant, ccMes, vista]);
  const totDim = filasDim.reduce((a, x) => a + x.cocina + x.bar, 0);
  const nombreDim = DIMS.find((d) => d.v === dim)!.t;

  return (
    <div>
      <Encabezado
        titulo="Compras de Cocina y Bar"
        descripcion={<>Las compras de los dos centros de costo que alimentan el costo de mercancía vendida, lado a lado y mes a mes. En la variación, ▲ en rojo es que se compró más que el mes anterior.</>}
      />
      <PestanasCompras />
      <BarraFiltros />
      {error && <p className="mb-4 text-sm text-alerta">{error}</p>}
      {!meses.length && !cargando ? <p className="text-sm text-texto-2">No hay compras de Cocina o Bar para este filtro.</p> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <TarjetaColor titulo="Compras Cocina" valor={fmtM(totC)} exacto={fmtPesos(totC)} nota={`${fmtPct(tot ? totC / tot : null)} de Cocina + Bar`} tema={TEMAS.compras} />
            <TarjetaColor titulo="Compras Bar" valor={fmtM(totB)} exacto={fmtPesos(totB)} nota={`${fmtPct(tot ? totB / tot : null)} de Cocina + Bar`} tema={TEMAS.costo} />
            <TarjetaColor titulo="Total Cocina + Bar" valor={fmtM(tot)} exacto={fmtPesos(tot)} nota={`${meses.length} meses · promedio ${fmtM(meses.length ? tot / meses.length : 0)} al mes`} tema={TEMAS.ventas} />
            <TarjetaColor titulo={`Cocina ${ult ? fmtMes(ult) : ""}`} valor={fmtM(fU?.cocina ?? 0)} exacto={fmtPesos(fU?.cocina ?? 0)}
              nota={fU?.vC != null ? `${fU.vC > 0 ? "▲" : "▼"} ${fmtPct(Math.abs(fU.vC))} frente a ${fmtMes(ant!)}` : "Sin mes anterior"} tema={fU?.vC != null && fU.vC > 0.05 ? TEMAS.alerta : TEMAS.compras} />
            <TarjetaColor titulo={`Bar ${ult ? fmtMes(ult) : ""}`} valor={fmtM(fU?.bar ?? 0)} exacto={fmtPesos(fU?.bar ?? 0)}
              nota={fU?.vB != null ? `${fU.vB > 0 ? "▲" : "▼"} ${fmtPct(Math.abs(fU.vB))} frente a ${fmtMes(ant!)}` : "Sin mes anterior"} tema={fU?.vB != null && fU.vB > 0.05 ? TEMAS.alerta : TEMAS.costo} />
          </div>

          <div className="mb-4 grid gap-3 2xl:grid-cols-[1fr_1.3fr]">
            <GraficoSeries titulo="Compras por mes · Cocina y Bar" datos={mensual.map((x) => ({ etiqueta: fmtMes(x.m), cocina: x.cocina, bar: x.bar }))}
              series={[{ clave: "cocina", nombre: "Cocina", color: COLOR.Cocina }, { clave: "bar", nombre: "Bar", color: COLOR.Bar }]} />
            <div className="tarjeta overflow-hidden !p-0">
              <h2 className="px-4 pt-3 pb-2 text-sm font-semibold text-tinta">Mes a mes</h2>
              <div className="overflow-x-auto">
                <table className="tabla">
                  <thead><tr><th>Mes</th><th className="num">Cocina</th><th className="num">Var.</th><th className="num">Bar</th><th className="num">Var.</th><th className="num">Total</th><th className="num">Var.</th><th className="num">% Cocina</th></tr></thead>
                  <tbody>
                    {mensual.map((x) => (
                      <tr key={x.m}>
                        <td className="font-medium">{fmtMes(x.m)}</td>
                        <td className="num">{fmtPesos(x.cocina)}</td><td className="num"><Var v={x.vC} /></td>
                        <td className="num">{fmtPesos(x.bar)}</td><td className="num"><Var v={x.vB} /></td>
                        <td className="num font-semibold">{fmtPesos(x.total)}</td><td className="num"><Var v={x.vT} /></td>
                        <td className="num text-texto-2">{fmtPct(x.total ? x.cocina / x.total : null)}</td>
                      </tr>
                    ))}
                    <tr className="font-semibold"><td>Total</td><td className="num">{fmtPesos(totC)}</td><td /><td className="num">{fmtPesos(totB)}</td><td /><td className="num">{fmtPesos(tot)}</td><td /><td className="num">{fmtPct(tot ? totC / tot : null)}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="tarjeta overflow-hidden !p-0">
            <div className="flex flex-wrap items-end gap-3 border-b border-linea px-4 py-3">
              <div>
                <span className="etiqueta">Ver por</span>
                <div className="flex h-9 overflow-hidden rounded-sm border border-linea bg-white text-sm" role="group">
                  {DIMS.map((d) => (
                    <button key={d.v} type="button" aria-pressed={dim === d.v} onClick={() => setDim(d.v)}
                      className={`border-r border-linea px-3 last:border-r-0 ${dim === d.v ? "bg-marca font-medium text-white" : "hover:bg-marca-suave"}`}>{d.t}</button>
                  ))}
                </div>
              </div>
              <div>
                <span className="etiqueta">Vista</span>
                <div className="flex h-9 overflow-hidden rounded-sm border border-linea bg-white text-sm" role="group">
                  <button type="button" aria-pressed={vista === "comparar"} onClick={() => setVista("comparar")} className={`border-r border-linea px-3 ${vista === "comparar" ? "bg-marca font-medium text-white" : "hover:bg-marca-suave"}`}>Cocina vs Bar</button>
                  <button type="button" aria-pressed={vista === "mensual"} onClick={() => setVista("mensual")} className={`px-3 ${vista === "mensual" ? "bg-marca font-medium text-white" : "hover:bg-marca-suave"}`}>Mes a mes</button>
                </div>
              </div>
              {vista === "mensual" && (
                <label><span className="etiqueta">Centro de costo</span>
                  <select className="campo w-36" value={ccMes} onChange={(e) => setCcMes(e.target.value as CC)}>
                    <option value="Ambos">Cocina + Bar</option><option value="Cocina">Cocina</option><option value="Bar">Bar</option>
                  </select>
                </label>
              )}
              <input className="campo ml-auto w-64" type="search" placeholder={`Buscar ${nombreDim.toLowerCase()}`} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="max-h-[70vh] overflow-auto">
              {vista === "comparar" ? (
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>{nombreDim}</th><th className="num">Cocina</th><th className="num">Bar</th><th className="num">Total</th><th className="num">% del total</th>
                      {dim === "articulo" && <><th className="num">Unidades</th><th className="num">Precio prom.</th></>}
                      <th className="num">{ant ? fmtMes(ant) : "Mes anterior"}</th><th className="num">{ult ? fmtMes(ult) : "Último mes"}</th><th className="num">Var.</th>
                      {dim === "articulo" && <th className="num">Var. precio</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {cargando ? <tr><td colSpan={12} className="text-texto-2">Cargando…</td></tr> : filasDim.slice(0, limite).map((x) => {
                      const t = x.cocina + x.bar, u = x.uC + x.uB;
                      const pU = x.uUlt ? x.ult / x.uUlt : null, pA = x.uAnt ? x.ant / x.uAnt : null;
                      return (
                        <tr key={x.k}>
                          <td className="max-w-[22rem] truncate font-medium" title={x.k}>{x.k}</td>
                          <td className="num" style={{ color: x.cocina ? undefined : "var(--color-texto-3)" }}>{x.cocina ? fmtPesos(x.cocina) : "—"}</td>
                          <td className="num">{x.bar ? fmtPesos(x.bar) : "—"}</td>
                          <td className="num font-semibold">{fmtPesos(t)}</td>
                          <td className="num text-texto-2">{fmtPct(totDim ? t / totDim : null)}</td>
                          {dim === "articulo" && <><td className="num">{fmtDec(u)}</td><td className="num">{u ? fmtPesos(t / u) : "—"}</td></>}
                          <td className="num text-texto-2">{x.ant ? fmtPesos(x.ant) : "—"}</td>
                          <td className="num">{x.ult ? fmtPesos(x.ult) : "—"}</td>
                          <td className="num"><Var v={x.ant ? varPct(x.ult, x.ant) : null} /></td>
                          {dim === "articulo" && <td className="num" title={pU && pA ? `${fmtPesos(pA)} → ${fmtPesos(pU)}` : undefined}><Var v={pU && pA ? varPct(pU, pA) : null} /></td>}
                        </tr>
                      );
                    })}
                    {!cargando && !filasDim.length && <tr><td colSpan={12} className="text-texto-3">Sin resultados.</td></tr>}
                  </tbody>
                </table>
              ) : (
                <table className="tabla">
                  <thead>
                    <tr><th>{nombreDim}</th>{meses.map((m) => <th key={m} className="num">{fmtMes(m)}</th>)}<th className="num">Total</th><th className="num">Var. último mes</th></tr>
                  </thead>
                  <tbody>
                    {cargando ? <tr><td colSpan={meses.length + 3} className="text-texto-2">Cargando…</td></tr> : filasDim.slice(0, limite).map((x) => (
                      <tr key={x.k}>
                        <td className="max-w-[20rem] truncate font-medium" title={x.k}>{x.k}</td>
                        {meses.map((m) => <td key={m} className="num">{x.mes[m] ? fmtPesos(x.mes[m]) : <span className="text-texto-3">—</span>}</td>)}
                        <td className="num font-semibold">{fmtPesos(x.cocina + x.bar)}</td>
                        <td className="num"><Var v={x.ant ? varPct(x.ult, x.ant) : null} /></td>
                      </tr>
                    ))}
                    {!cargando && !filasDim.length && <tr><td colSpan={meses.length + 3} className="text-texto-3">Sin resultados.</td></tr>}
                  </tbody>
                </table>
              )}
            </div>
            {dim === "articulo" && vista === "comparar" && (
              <p className="border-t border-linea px-4 py-2 text-[11px] text-texto-3">
                Precio prom. = valor ÷ unidades. Var. precio compara el precio promedio del último mes con el anterior (pasa el mouse para ver los dos precios).
                Si el artículo cambió de unidad de compra entre meses (gramos, kilo, paquete), el precio no es comparable.
              </p>
            )}
            {filasDim.length > limite && (
              <div className="flex items-center gap-3 border-t border-linea px-4 py-2 text-xs text-texto-2">
                <button className="boton-sec !h-8" onClick={() => setLimite((l) => l + 200)}>Mostrar más</button>
                Mostrando {fmtNum(limite)} de {fmtNum(filasDim.length)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
