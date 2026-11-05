"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/Contexto";
import { BarraFiltros } from "@/components/BarraFiltros";
import { Encabezado } from "@/components/Encabezado";
import { GraficoDosBarras, GraficoLinea } from "@/components/Graficos";
import { Tarjeta } from "@/components/Indicadores";
import { ListaBarras } from "@/components/ListaBarras";
import { fmtM, fmtMes, fmtNum, fmtPct, fmtPesos } from "@/lib/formato";
import { cifras } from "@/lib/rentabilidad";
import { useCostos } from "@/lib/useCostos";
import { ComparacionSedesCostos } from "@/components/ComparacionSedes";

// Costo de cada plato = Coste de la ficha (hoja RENTABILIDAD) × unidades vendidas (hoja VENTAS).
// Utilidad = Venta base − Costo · Margen = Utilidad / Venta base · Costo % = Costo / Venta base.
type ItemBD = { m: number; a: string; f: string | null; c: string | null; u: number; b: number; k: number | null; p: number | null; x: boolean };
type Item = {
  marca: number; art: string; fam: string; cc: string; uds: number; base: number; ficha: boolean; cuni: number;
  costo: number; util: number; cpct: number | null; mpct: number | null; warn: boolean; partU: number; partV: number; score?: number;
};
type Ficha = { id: number; marca_id: number; tarifa: string | null; familia: string | null; articulo: string | null; referencia: string | null; precio: number; impuesto: number; base: number; coste: number };

const PAGINA = 250;

export default function IngenieriaMenu() {
  const { sb, filtros, marcas, meta } = useApp();
  const costos = useCostos();
  const [datos, setDatos] = useState<{ items: ItemBD[]; tendencia: { mes: string; base: number; costo: number }[]; fichas: number } | null>(null);
  const [kpis, setKpis] = useState<{ ventas: number; facturas: number } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buscar, setBuscar] = useState("");
  const [ccTabla, setCcTabla] = useState<"todos" | "Cocina" | "Bar">("todos");
  const [soloAlerta, setSoloAlerta] = useState(false);
  const [limite, setLimite] = useState(PAGINA);
  const [famReco, setFamReco] = useState("");
  const [fichas, setFichas] = useState<Ficha[] | null>(null);
  const [verFichas, setVerFichas] = useState(false);
  const [buscarFicha, setBuscarFicha] = useState("");

  const pcc = filtros.cc === "todos" ? null : filtros.cc;
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const args = { p_marca: filtros.marcaId, p_sede: filtros.sedeId, p_desde: filtros.desde || null, p_hasta: filtros.hasta || null, p_cc: pcc };
    Promise.all([sb.rpc("ingenieria_menu", args), sb.rpc("ventas_kpis", args)]).then(([m, k]) => {
      if (!vivo) return;
      setError(m.error?.message ?? k.error?.message ?? null);
      setDatos((m.data as typeof datos) ?? { items: [], tendencia: [], fichas: 0 });
      setKpis(k.data as typeof kpis);
      setCargando(false);
      setLimite(PAGINA);
    });
    return () => { vivo = false; };
  }, [sb, filtros.marcaId, filtros.sedeId, filtros.desde, filtros.hasta, pcc]);

  // Hoja RENTABILIDAD tal cual (para auditar de dónde sale cada costo)
  useEffect(() => {
    if (!verFichas) return;
    let vivo = true;
    (async () => {
      const todos: Ficha[] = [];
      for (let desde = 0; ; desde += 1000) {
        let q = sb.from("rentabilidad_items").select("id,marca_id,tarifa,familia,articulo,referencia,precio,impuesto,base,coste").order("id").range(desde, desde + 999);
        if (filtros.marcaId) q = q.eq("marca_id", filtros.marcaId);
        const { data, error } = await q;
        if (error || !data) break;
        todos.push(...(data as Ficha[]));
        if (data.length < 1000) break;
      }
      if (vivo) setFichas(todos);
    })();
    return () => { vivo = false; };
  }, [sb, filtros.marcaId, verFichas]);

  const { items, T } = useMemo(() => {
    const brutos = datos?.items ?? [];
    const tu = brutos.reduce((a, x) => a + Number(x.u), 0);
    const tb = brutos.reduce((a, x) => a + Number(x.b), 0);
    const items: Item[] = brutos.map((x) => {
      const uds = Number(x.u), base = Number(x.b), cuni = x.x ? Number(x.k) : 0;
      const costo = cuni * uds, util = base - costo;
      const cpct = x.x && base ? costo / base : null;
      return {
        marca: x.m, art: x.a, fam: x.f ?? "SIN FAMILIA", cc: x.c ?? "Otros", uds, base, ficha: x.x, cuni, costo, util,
        cpct, mpct: x.x && base ? util / base : null, warn: !!(x.x && cpct != null && cpct > meta),
        partU: tu ? uds / tu : 0, partV: tb ? base / tb : 0,
      };
    }).sort((a, b) => b.base - a.base);
    const conF = items.filter((i) => i.ficha);
    const baseF = conF.reduce((a, i) => a + i.base, 0);
    const costo = conF.reduce((a, i) => a + i.costo, 0);
    const T = {
      n: items.length, nf: conF.length, nw: items.filter((i) => i.warn).length, uds: tu, base: tb, baseF, costo,
      util: baseF - costo, cpct: baseF ? costo / baseF : null, mpct: baseF ? (baseF - costo) / baseF : null,
    };
    return { items, T };
  }, [datos, meta]);

  const marcaNombre = (id: number) => marcas.find((m) => m.id === id)?.nombre ?? "";
  const conF = items.filter((i) => i.ficha);
  const facturas = Number(kpis?.facturas ?? 0);
  const ventasKpi = Number(kpis?.ventas ?? 0);
  const ticket = facturas ? ventasKpi / facturas : null;
  const cpp = T.uds ? T.costo / T.uds : null;
  const juego = cifras(costos.total, filtros.cc);

  // Productos que los meseros deben ofrecer primero: margen 40 %, rotación 30 %, utilidad 30 %
  const familiasReco = [...new Set(conF.filter((o) => o.util > 0).map((o) => o.fam))].sort();
  const reco = useMemo(() => {
    let c = conF.filter((o) => o.util > 0 && o.uds > 0);
    if (famReco) c = c.filter((o) => o.fam === famReco);
    const mxM = Math.max(0, ...c.map((o) => o.mpct ?? 0));
    const mxU = Math.max(0, ...c.map((o) => o.uds));
    const mxT = Math.max(0, ...c.map((o) => o.util));
    return c
      .map((o) => ({ ...o, score: (mxM ? (o.mpct ?? 0) / mxM : 0) * 40 + (mxU ? o.uds / mxU : 0) * 30 + (mxT ? o.util / mxT : 0) * 30 }))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 15);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, famReco]);

  const q = buscar.trim().toUpperCase();
  const tabla = items.filter((o) => (ccTabla === "todos" || o.cc === ccTabla) && (!soloAlerta || o.warn) && (!q || `${o.art} ${o.fam}`.includes(q)));
  const porFamilia = (campo: "base" | "costo", lista: Item[]) => {
    const m = new Map<string, number>();
    lista.forEach((o) => m.set(o.fam, (m.get(o.fam) ?? 0) + o[campo]));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => ({ k, v }));
  };
  const porCC = (() => {
    const m = new Map<string, number>();
    items.forEach((o) => m.set(o.cc, (m.get(o.cc) ?? 0) + o.base));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v, detalle: fmtPct(T.base ? v / T.base : 0) }));
  })();
  const muestraMarca = filtros.marcaId == null;

  return (
    <div>
      <Encabezado
        titulo="Rentabilidad de carta"
        descripcion={<>Ingeniería del menú. El costo de cada plato sale <b>solo</b> de la hoja RENTABILIDAD (columna Coste) multiplicado por las unidades vendidas; la venta base sale de VENTAS. Se descartan tarifas de Rappi, personal y empleados, y familias que no son producto (adiciones, cortesías, descuentos, propinas…). Meta de costo: {fmtPct(meta)} como máximo.</>}
      />
      <BarraFiltros />
      {error && <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {cargando || !datos ? (
        <p className="text-sm text-texto-2">Cargando…</p>
      ) : (
        <>
          {datos.fichas === 0 ? (
            <p className="mb-4 rounded-md bg-alerta-suave p-3 text-sm text-alerta">
              Esta marca aún no tiene la hoja RENTABILIDAD cargada: sin fichas no se puede calcular costo, utilidad ni margen de cada plato. Súbela en Cargar datos → Rentabilidad de carta.
            </p>
          ) : T.n - T.nf > 0 ? (
            <p className="mb-4 text-xs text-texto-2">
              {fmtNum(T.n)} productos vendidos · {fmtNum(datos.fichas)} fichas leídas · <b>{fmtNum(T.n - T.nf)}</b> productos sin ficha: aparecen con sus unidades y venta base, pero no entran en costo, utilidad, margen ni rankings.
            </p>
          ) : null}

          <h2 className="mb-2 text-sm font-semibold text-tinta">Juego de inventarios del período</h2>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tarjeta titulo="Ventas totales" valor={fmtM(juego.ventasTot)} exacto={fmtPesos(juego.ventasTot)} nota="Base neta: sin IVA ni propinas" />
            <Tarjeta titulo="Mercancía vendida" valor={fmtM(juego.mv)} exacto={fmtPesos(juego.mv)} nota="Inv. inicial + Compras − Inv. final" />
            <Tarjeta titulo="Costo global" valor={fmtPct(juego.pct)} exacto={fmtPesos(juego.mv)} nota={juego.pct != null && juego.pct > meta ? `Por encima de la meta (${fmtPct(meta)})` : `Dentro de la meta (${fmtPct(meta)})`} tono={juego.pct != null && juego.pct > meta ? "alerta" : "bien"} />
            <Tarjeta titulo="Utilidad bruta" valor={fmtM(juego.utilidad)} exacto={fmtPesos(juego.utilidad)} nota={`${fmtPct(juego.pctUtil)} sobre las ventas`} />
          </div>

          <h2 className="mb-2 text-sm font-semibold text-tinta">Desempeño del menú</h2>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Tarjeta titulo="Venta base" valor={fmtM(T.base)} exacto={fmtPesos(T.base)} />
            <Tarjeta titulo="Costo de fichas" valor={fmtM(T.costo)} exacto={fmtPesos(T.costo)} />
            <Tarjeta titulo="Utilidad bruta" valor={fmtM(T.util)} exacto={fmtPesos(T.util)} nota="Solo productos con ficha" />
            <Tarjeta titulo="Margen bruto" valor={fmtPct(T.mpct)} />
            <Tarjeta titulo="Costo sobre venta" valor={fmtPct(T.cpct)} tono={T.cpct != null && T.cpct > meta ? "alerta" : "bien"} nota={`Meta ${fmtPct(meta)}`} />
            <Tarjeta titulo={`Productos sobre ${fmtPct(meta)}`} valor={fmtNum(T.nw)} tono={T.nw ? "alerta" : undefined} nota="Revisar precio o receta" />
            <Tarjeta titulo="Unidades vendidas" valor={fmtNum(T.uds)} />
            <Tarjeta titulo="Facturas" valor={facturas ? fmtNum(facturas) : "—"} nota={facturas ? undefined : "Vuelve a subir las ventas para contarlas"} />
            <Tarjeta titulo="Ticket promedio" valor={ticket ? fmtPesos(ticket) : "—"} nota={ticket ? "Ventas ÷ facturas" : undefined} />
            <Tarjeta titulo="Costo promedio por plato" valor={cpp ? fmtPesos(cpp) : "—"} />
          </div>

          <ComparacionSedesCostos metrica="ventas" />
          <div className="mb-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
            <ListaBarras titulo="Mayor utilidad" filas={[...conF].sort((a, b) => b.util - a.util).slice(0, 10).map((o) => ({ k: o.art, v: o.util, detalle: `${fmtNum(o.uds)} uds` }))} formato={fmtM} />
            <ListaBarras titulo="Más vendidos" filas={[...items].sort((a, b) => b.uds - a.uds).slice(0, 10).map((o) => ({ k: o.art, v: o.uds }))} formato={fmtNum} />
            <ListaBarras titulo="Mejor margen" filas={conF.filter((o) => (o.mpct ?? 0) > 0).sort((a, b) => (b.mpct ?? 0) - (a.mpct ?? 0)).slice(0, 10).map((o) => ({ k: o.art, v: o.mpct ?? 0, detalle: `${fmtNum(o.uds)} uds` }))} formato={(v) => fmtPct(v)} />
            <ListaBarras titulo={`Costo por encima del ${fmtPct(meta)}`} vacio={`Ningún producto supera el ${fmtPct(meta)}`} filas={conF.filter((o) => o.warn).sort((a, b) => (b.cpct ?? 0) - (a.cpct ?? 0)).slice(0, 10).map((o) => ({ k: o.art, v: o.cpct ?? 0, alerta: true, detalle: `${fmtNum(o.uds)} uds` }))} formato={(v) => fmtPct(v)} />
          </div>

          <div className="tarjeta mb-5 overflow-hidden !p-0">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-linea px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-tinta">Productos que los meseros deben ofrecer primero</h2>
                <p className="text-xs text-texto-3">Prioridad = margen 40 % + rotación 30 % + utilidad 30 %, comparado contra el mejor de cada criterio.</p>
              </div>
              <label><span className="etiqueta">Familia</span>
                <select className="campo w-56" value={famReco} onChange={(e) => setFamReco(e.target.value)}>
                  <option value="">Todas</option>
                  {familiasReco.map((f) => <option key={f}>{f}</option>)}
                </select>
              </label>
            </div>
            <div className="overflow-auto">
              <table className="tabla">
                <thead><tr><th>#</th><th>Producto</th><th>Centro</th><th className="num">Uds</th><th className="num">Part. uds</th><th className="num">Venta base</th><th className="num">Costo</th><th className="num">Utilidad</th><th className="num">Margen</th><th className="num">Prioridad</th></tr></thead>
                <tbody>
                  {reco.length === 0 ? <tr><td colSpan={10} className="text-texto-3">Sin fichas de costo para recomendar.</td></tr> : reco.map((o, i) => (
                    <tr key={`${o.marca}-${o.art}`}>
                      <td className="text-texto-3">{i + 1}</td>
                      <td className="max-w-[18rem] truncate font-medium text-tinta" title={o.art}>{o.art}</td>
                      <td>{o.cc}</td>
                      <td className="num">{fmtNum(o.uds)}</td>
                      <td className="num">{fmtPct(o.partU)}</td>
                      <td className="num">{fmtNum(o.base)}</td>
                      <td className={`num ${o.warn ? "text-alerta" : ""}`}>{fmtNum(o.costo)}</td>
                      <td className="num text-bien">{fmtNum(o.util)}</td>
                      <td className="num">{fmtPct(o.mpct)}</td>
                      <td className="num font-semibold">{Math.round(o.score ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="tarjeta mb-5 overflow-hidden !p-0">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-linea px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-tinta">Ingeniería del menú</h2>
                <p className="text-xs text-texto-3">{fmtNum(tabla.length)} productos · cifras en pesos</p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <input className="campo w-56" placeholder="Buscar producto o familia" value={buscar} onChange={(e) => { setBuscar(e.target.value); setLimite(PAGINA); }} />
                <div className="flex h-9 overflow-hidden rounded-md border border-linea text-sm">
                  {(["todos", "Cocina", "Bar"] as const).map((c) => (
                    <button key={c} type="button" onClick={() => setCcTabla(c)} className={`px-3 ${ccTabla === c ? "bg-marca text-white" : "text-texto-2 hover:bg-fondo"} ${c !== "todos" ? "border-l border-linea" : ""}`}>{c === "todos" ? "Todos" : c}</button>
                  ))}
                </div>
                <button type="button" onClick={() => setSoloAlerta((v) => !v)} className={`h-9 rounded-md border px-3 text-sm ${soloAlerta ? "border-alerta bg-alerta-suave font-medium text-alerta" : "border-linea text-texto-2 hover:bg-fondo"}`}>
                  Solo costo &gt; {fmtPct(meta)}
                </button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              <table className="tabla col-fija">
                <thead>
                  <tr>
                    <th>Producto</th>{muestraMarca && <th>Marca</th>}<th>Centro</th><th>Familia</th><th className="num">Uds</th><th className="num">Part. uds</th>
                    <th className="num">Venta base</th><th className="num">Costo</th><th className="num">Costo %</th><th className="num">Utilidad</th><th className="num">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {tabla.slice(0, limite).map((o) => (
                    <tr key={`${o.marca}-${o.art}`} className={o.warn ? "bg-alerta-suave/50" : ""}>
                      <td className="max-w-[20rem] truncate font-medium text-tinta" title={o.art}>{o.art}</td>
                      {muestraMarca && <td className="text-texto-2">{marcaNombre(o.marca)}</td>}
                      <td>{o.cc}</td>
                      <td className="max-w-[12rem] truncate text-texto-2" title={o.fam}>{o.fam}</td>
                      <td className="num">{fmtNum(o.uds)}</td>
                      <td className="num">{fmtPct(o.partU)}</td>
                      <td className="num">{fmtNum(o.base)}</td>
                      <td className="num">{o.ficha ? fmtNum(o.costo) : <span className="text-texto-3">Sin ficha</span>}</td>
                      <td className={`num font-medium ${o.warn ? "text-alerta" : ""}`}>{o.ficha ? <>{o.warn ? "▲ " : ""}{fmtPct(o.cpct)}</> : "—"}</td>
                      <td className="num">{o.ficha ? fmtNum(o.util) : "—"}</td>
                      <td className="num">{o.ficha ? fmtPct(o.mpct) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {tabla.length > limite && (
              <div className="flex items-center gap-3 border-t border-linea px-4 py-2 text-xs text-texto-2">
                <button className="boton-sec !h-8" onClick={() => setLimite((l) => l + PAGINA)}>Mostrar {Math.min(PAGINA, tabla.length - limite)} más</button>
                Mostrando {fmtNum(limite)} de {fmtNum(tabla.length)}
              </div>
            )}
          </div>

          <div className="mb-5 grid gap-3 lg:grid-cols-3">
            <ListaBarras titulo="Ventas por familia" filas={porFamilia("base", items).map((x) => ({ ...x, detalle: fmtPct(T.base ? x.v / T.base : 0) }))} formato={fmtM} />
            <ListaBarras titulo="Costos por familia" filas={porFamilia("costo", conF).map((x) => ({ ...x, detalle: fmtPct(T.costo ? x.v / T.costo : 0) }))} formato={fmtM} color="#eb6834" />
            <ListaBarras titulo="Participación por centro de costo" filas={porCC} formato={fmtM} />
          </div>

          {datos.tendencia.length > 0 && (
            <div className="mb-5 grid gap-3 lg:grid-cols-2">
              <GraficoDosBarras
                titulo="Tendencia mensual: venta base y costo de fichas"
                nombres={["Venta base", "Costo (fichas)"]}
                datos={datos.tendencia.map((t) => ({ etiqueta: fmtMes(t.mes), a: Number(t.base), b: Number(t.costo) }))}
              />
              <GraficoLinea
                titulo="Tendencia mensual: margen del menú"
                datos={datos.tendencia.map((t) => ({ etiqueta: fmtMes(t.mes), valor: Number(t.base) ? (Number(t.base) - Number(t.costo)) / Number(t.base) : null }))}
              />
            </div>
          )}

          <div className="tarjeta overflow-hidden !p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linea px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-tinta">Hoja RENTABILIDAD (fichas)</h2>
                <p className="text-xs text-texto-3">Tal cual se cargó, para auditar de dónde sale el costo de cada plato.</p>
              </div>
              {verFichas ? (
                <input className="campo w-56" placeholder="Buscar en las fichas" value={buscarFicha} onChange={(e) => setBuscarFicha(e.target.value)} />
              ) : (
                <button className="boton-sec" onClick={() => setVerFichas(true)}>Ver fichas</button>
              )}
            </div>
            {verFichas && (
              <div className="max-h-[60vh] overflow-auto">
                {!fichas ? <p className="p-4 text-sm text-texto-2">Cargando…</p> : (
                  <table className="tabla">
                    <thead><tr>{muestraMarca && <th>Marca</th>}<th>Tarifa</th><th>Familia</th><th>Artículo</th><th>Ref.</th><th className="num">Precio</th><th className="num">Base</th><th className="num">Coste</th><th className="num">Costo %</th></tr></thead>
                    <tbody>
                      {fichas.filter((f) => !buscarFicha || `${f.articulo} ${f.referencia} ${f.familia}`.toUpperCase().includes(buscarFicha.toUpperCase())).slice(0, 1000).map((f) => {
                        const pct = Number(f.base) ? Number(f.coste) / Number(f.base) : null;
                        return (
                          <tr key={f.id}>
                            {muestraMarca && <td>{marcaNombre(f.marca_id)}</td>}
                            <td className="text-texto-2">{f.tarifa}</td><td className="text-texto-2">{f.familia}</td>
                            <td className="font-medium text-tinta">{f.articulo}</td><td className="text-texto-2">{f.referencia}</td>
                            <td className="num">{fmtNum(Number(f.precio))}</td><td className="num">{fmtNum(Number(f.base))}</td><td className="num">{fmtNum(Number(f.coste))}</td>
                            <td className={`num ${pct != null && pct > meta ? "font-medium text-alerta" : ""}`}>{fmtPct(pct)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
