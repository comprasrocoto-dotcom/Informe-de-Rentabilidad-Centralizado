"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/Contexto";
import { BarraFiltros } from "@/components/BarraFiltros";
import { div, fmtNum, fmtPct } from "@/lib/formato";

type Item = {
  id: number; marca_id: number; tarifa: string | null; familia: string | null; centro_costos: string | null;
  articulo: string | null; referencia: string | null; precio: number; impuesto: number; base: number; coste: number;
};

export default function Carta() {
  const { sb, filtros, marcas } = useApp();
  const [items, setItems] = useState<Item[]>([]);
  const [cargando, setCargando] = useState(true);
  const [tarifa, setTarifa] = useState("");
  const [familia, setFamilia] = useState("");
  const [buscar, setBuscar] = useState("");
  const [objetivo, setObjetivo] = useState(35);
  const [orden, setOrden] = useState<"pct" | "articulo" | "precio">("pct");

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCargando(true);
      const todos: Item[] = [];
      for (let desde = 0; ; desde += 1000) {
        let q = sb.from("rentabilidad_items")
          .select("id,marca_id,tarifa,familia,centro_costos,articulo,referencia,precio,impuesto,base,coste")
          .order("id").range(desde, desde + 999);
        if (filtros.marcaId) q = q.eq("marca_id", filtros.marcaId);
        const { data, error } = await q;
        if (error || !data) break;
        todos.push(...(data as Item[]));
        if (data.length < 1000) break;
      }
      if (vivo) { setItems(todos); setCargando(false); }
    })();
    return () => { vivo = false; };
  }, [sb, filtros.marcaId]);

  const tarifas = useMemo(() => [...new Set(items.map((i) => i.tarifa ?? ""))].filter(Boolean).sort(), [items]);
  const familias = useMemo(() => [...new Set(items.filter((i) => !tarifa || i.tarifa === tarifa).map((i) => i.familia ?? ""))].filter(Boolean).sort(), [items, tarifa]);
  const marcaNombre = (id: number) => marcas.find((m) => m.id === id)?.nombre ?? "";

  const vista = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    const r = items
      .filter((i) => (!tarifa || i.tarifa === tarifa) && (!familia || i.familia === familia))
      .filter((i) => !q || (i.articulo ?? "").toLowerCase().includes(q) || (i.referencia ?? "").toLowerCase().includes(q))
      .map((i) => ({ ...i, pct: div(Number(i.coste), Number(i.base)) }));
    r.sort((a, b) =>
      orden === "pct" ? (b.pct ?? -1) - (a.pct ?? -1) : orden === "precio" ? b.precio - a.precio : (a.articulo ?? "").localeCompare(b.articulo ?? ""),
    );
    return r;
  }, [items, tarifa, familia, buscar, orden]);

  const sobre = vista.filter((i) => i.pct != null && i.pct > objetivo / 100).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-[22px] font-semibold tracking-tight text-tinta">Rentabilidad de carta</h1>
        <p className="text-xs text-texto-2">% costo = Costo del plato / Precio sin impuesto</p>
      </div>
      <BarraFiltros sinFechas sinSede />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label><span className="etiqueta">Tarifa</span>
          <select className="campo" value={tarifa} onChange={(e) => { setTarifa(e.target.value); setFamilia(""); }}>
            <option value="">Todas</option>{tarifas.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label><span className="etiqueta">Familia</span>
          <select className="campo" value={familia} onChange={(e) => setFamilia(e.target.value)}>
            <option value="">Todas</option>{familias.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label><span className="etiqueta">Buscar plato o referencia</span>
          <input className="campo" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Ej: ceviche" />
        </label>
        <label><span className="etiqueta">Resaltar si el costo supera</span>
          <span className="flex items-center gap-1"><input type="number" min={1} max={100} className="campo w-20" value={objetivo} onChange={(e) => setObjetivo(Number(e.target.value) || 0)} /> %</span>
        </label>
        <label><span className="etiqueta">Ordenar por</span>
          <select className="campo" value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)}>
            <option value="pct">% costo (mayor primero)</option>
            <option value="precio">Precio</option>
            <option value="articulo">Nombre</option>
          </select>
        </label>
      </div>

      {cargando ? <p className="text-sm text-texto-2">Cargando…</p> : (
        <>
          <p className="mb-2 text-sm text-texto-2">
            {vista.length} productos · <b className="text-[var(--alerta)]">{sobre}</b> con costo mayor a {objetivo}%
          </p>
          <div className="tarjeta max-h-[70vh] overflow-auto !p-0">
            <table className="tabla col-fija">
              <thead>
                <tr>
                  {filtros.marcaId == null && <th>Marca</th>}
                  <th>Tarifa</th><th>Familia</th><th>Artículo</th><th>Ref.</th>
                  <th className="num">Precio</th><th className="num">Base sin imp.</th><th className="num">Costo</th>
                  <th className="num">Margen</th><th className="num">% Costo</th>
                </tr>
              </thead>
              <tbody>
                {vista.map((i) => {
                  const alto = i.pct != null && i.pct > objetivo / 100;
                  return (
                    <tr key={i.id} className={alto ? "bg-alerta-suave" : ""}>
                      {filtros.marcaId == null && <td>{marcaNombre(i.marca_id)}</td>}
                      <td className="text-texto-2">{i.tarifa}</td>
                      <td className="text-texto-2">{i.familia}</td>
                      <td className="max-w-[20rem] truncate font-medium text-tinta" title={i.articulo ?? ""}>{i.articulo}</td>
                      <td className="text-texto-2">{i.referencia}</td>
                      <td className="num">{fmtNum(Number(i.precio))}</td>
                      <td className="num">{fmtNum(Number(i.base))}</td>
                      <td className="num">{fmtNum(Number(i.coste))}</td>
                      <td className="num">{fmtNum(Number(i.base) - Number(i.coste))}</td>
                      <td className={`num font-medium ${alto ? "text-[var(--alerta)]" : ""}`}>{alto ? "▲ " : ""}{fmtPct(i.pct)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
