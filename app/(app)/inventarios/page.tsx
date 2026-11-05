"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/Contexto";
import { BarraFiltros } from "@/components/BarraFiltros";
import { Encabezado } from "@/components/Encabezado";
import { notaConteo, Tarjeta } from "@/components/Indicadores";
import { ListaBarras } from "@/components/ListaBarras";
import { fmtDec, fmtFecha, fmtM, fmtNum, fmtPct } from "@/lib/formato";
import { cifras } from "@/lib/rentabilidad";
import { useCostos } from "@/lib/useCostos";
import { ComparacionSedesCostos } from "@/components/ComparacionSedes";

type Det = {
  total: number; referencias: number; fechas: string[];
  por_cc: { k: string; v: number }[]; por_familia: { k: string; v: number }[];
  pivot: { cc: string; f: string; v: number }[];
  top: { a: string; f: string; c: string; s: number; v: number }[];
};

export default function Inventarios() {
  const { sb, filtros } = useApp();
  const { total } = useCostos();
  const [d, setD] = useState<Det | null>(null);
  const pcc = filtros.cc === "todos" ? null : filtros.cc;

  useEffect(() => {
    let vivo = true;
    sb.rpc("inventario_detalle", { p_marca: filtros.marcaId, p_sede: filtros.sedeId, p_desde: filtros.desde || null, p_hasta: filtros.hasta || null, p_cc: pcc })
      .then(({ data }) => { if (vivo) setD(data as Det); });
    return () => { vivo = false; };
  }, [sb, filtros.marcaId, filtros.sedeId, filtros.desde, filtros.hasta, pcc]);

  const c = cifras(total, filtros.cc);
  // Tabla centro de costo × familia (las 12 familias de mayor valor)
  const familias = (d?.por_familia ?? []).slice(0, 12).map((x) => x.k);
  const centros = [...new Set((d?.pivot ?? []).map((x) => x.cc))].sort();
  const valor = (cc: string, f: string) => (d?.pivot ?? []).filter((x) => x.cc === cc && x.f === f).reduce((a, x) => a + Number(x.v), 0);

  return (
    <div>
      <Encabezado titulo="Inventarios" descripcion="Valor inventariado en el último conteo del período de cada sede. Cada fecha de documento es un conteo." />
      <BarraFiltros />
      {!d ? <p className="text-sm text-texto-2">Cargando…</p> : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tarjeta titulo="Inventario inicial" valor={fmtM(c.invIni)} nota={notaConteo(c, "ini")} />
            <Tarjeta titulo="Inventario final" valor={fmtM(c.invFin)} nota={notaConteo(c, "fin")} />
            <Tarjeta titulo="Mercancía vendida" valor={fmtM(c.mv)} nota={`${fmtPct(c.pct)} sobre ventas`} />
            <Tarjeta titulo="Referencias" valor={fmtNum(Number(d.referencias))} nota={`Artículos inventariados${d.fechas.length ? ` · conteo del ${d.fechas.map(fmtFecha).slice(-3).join(", ")}` : ""}`} />
          </div>
          <ComparacionSedesCostos metrica="invFinal" />
          <div className="mb-5 grid gap-3 lg:grid-cols-3">
            <ListaBarras titulo="Inventario por centro de costo" filas={d.por_cc.map((x) => ({ k: x.k, v: Number(x.v) }))} formato={fmtM} />
            <ListaBarras titulo="Inventario por familia" filas={d.por_familia.slice(0, 12).map((x) => ({ k: x.k, v: Number(x.v), detalle: d.total ? fmtPct(Number(x.v) / Number(d.total)) : "" }))} formato={fmtM} />
            <div className="tarjeta">
              <h3 className="text-sm font-semibold text-tinta">Total inventario del último conteo</h3>
              <div className="mt-2 text-[34px] leading-none font-semibold tracking-tight text-tinta tabular-nums">{fmtM(Number(d.total))}</div>
              <p className="mt-2 text-xs text-texto-3">{fmtNum(Number(d.referencias))} referencias</p>
            </div>
          </div>
          <div className="tarjeta mb-5 overflow-hidden !p-0">
            <div className="border-b border-linea px-4 py-3"><h2 className="text-sm font-semibold text-tinta">Centro de costo × familia</h2><p className="text-xs text-texto-3">Pesos</p></div>
            <div className="overflow-auto">
              <table className="tabla col-fija">
                <thead><tr><th>Centro de costo</th>{familias.map((f) => <th key={f} className="num">{f}</th>)}<th className="num">Total</th></tr></thead>
                <tbody>
                  {centros.map((cc) => {
                    const t = familias.reduce((a, f) => a + valor(cc, f), 0);
                    return (
                      <tr key={cc}>
                        <td className="font-medium">{cc}</td>
                        {familias.map((f) => <td key={f} className="num">{valor(cc, f) ? fmtNum(valor(cc, f)) : "—"}</td>)}
                        <td className="num font-semibold">{fmtNum(t)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="tarjeta overflow-hidden !p-0">
            <div className="border-b border-linea px-4 py-3"><h2 className="text-sm font-semibold text-tinta">Top 10 artículos por valor inventariado</h2></div>
            <table className="tabla">
              <thead><tr><th>#</th><th>Artículo</th><th>Familia</th><th>Centro</th><th className="num">Stock</th><th className="num">Valor</th></tr></thead>
              <tbody>
                {d.top.map((t, i) => (
                  <tr key={i}>
                    <td className="text-texto-3">{i + 1}</td><td className="font-medium text-tinta">{t.a}</td><td className="text-texto-2">{t.f}</td><td>{t.c}</td>
                    <td className="num">{fmtDec(Number(t.s))}</td><td className="num">{fmtNum(Number(t.v))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
