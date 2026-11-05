"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/Contexto";
import { BarraFiltros } from "@/components/BarraFiltros";
import { Encabezado } from "@/components/Encabezado";
import { GraficoPctCentros } from "@/components/Graficos";
import { notaMV, PctMeta, Tarjeta } from "@/components/Indicadores";
import { fmtM, fmtMes, fmtNum, fmtPct, fmtPesos } from "@/lib/formato";
import { cifras } from "@/lib/rentabilidad";
import { useCostos } from "@/lib/useCostos";

type Audit = { tabla: string; valor: string; clasificado: string; filas: number; total: number };

export default function Costo() {
  const { sb, filtros, meta, marcas } = useApp();
  const { cargando, total, porMes, porMesSede, sedePorId } = useCostos();
  const [audit, setAudit] = useState<Audit[]>([]);

  useEffect(() => {
    let vivo = true;
    sb.rpc("auditoria_cc", { p_marca: filtros.marcaId, p_sede: filtros.sedeId, p_desde: filtros.desde || null, p_hasta: filtros.hasta || null })
      .then(({ data }) => { if (vivo) setAudit((data as Audit[]) ?? []); });
    return () => { vivo = false; };
  }, [sb, filtros.marcaId, filtros.sedeId, filtros.desde, filtros.hasta]);

  const g = cifras(total, "todos"), co = cifras(total, "Cocina"), ba = cifras(total, "Bar");
  const mejor = [{ s: "Cocina", c: co }, { s: "Bar", c: ba }].filter((x) => x.c.pct != null && x.c.pct > 0).sort((a, b) => (a.c.pct ?? 0) - (b.c.pct ?? 0))[0];
  const tono = (p: number | null) => (p == null ? undefined : p > meta ? "alerta" : "bien") as "alerta" | "bien" | undefined;
  const marcaNombre = (id: number) => marcas.find((m) => m.id === id)?.nombre ?? "";
  const nombreSede = (id: number) => {
    const s = sedePorId.get(id);
    return s ? (filtros.marcaId == null ? `${marcaNombre(s.marca_id)} · ${s.nombre}` : s.nombre) : `Sede ${id}`;
  };

  return (
    <div>
      <Encabezado
        titulo="Costo por centro de costo"
        descripcion={<>Costo global = mercancía vendida ÷ (ventas totales − ventas excluidas). Por centro: mercancía vendida del centro ÷ ventas del centro. Meta: {fmtPct(meta)}.</>}
      />
      <BarraFiltros sinCC />
      {cargando ? <p className="text-sm text-texto-2">Cargando…</p> : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Tarjeta titulo="Costo Cocina" valor={fmtPct(co.pct)} exacto={fmtPesos(co.mv)} nota={`Sobre ventas de ${fmtM(co.ventasBase)}`} tono={tono(co.pct)} />
            <Tarjeta titulo="Costo Bar" valor={fmtPct(ba.pct)} exacto={fmtPesos(ba.mv)} nota={`Sobre ventas de ${fmtM(ba.ventasBase)}`} tono={tono(ba.pct)} />
            <Tarjeta titulo="Costo global" valor={fmtPct(g.pct)} exacto={fmtPesos(g.mv)} nota={`Sobre ventas base de ${fmtM(g.ventasBase)}`} tono={tono(g.pct)} />
            <Tarjeta titulo="Utilidad bruta" valor={fmtM(g.utilidad)} exacto={fmtPesos(g.utilidad)} nota={`${fmtPct(g.pctUtil)} sobre las ventas`} />
            <Tarjeta titulo="Mejor costo por centro" valor={mejor ? fmtPct(mejor.c.pct) : "—"} exacto={mejor?.s} nota={mejor ? `${fmtM(mejor.c.mv)} sobre ${fmtM(mejor.c.ventasBase)}` : undefined} />
          </div>
          <p className="mb-4 text-xs text-texto-3">Cálculo: {notaMV(g)}</p>

          <div className="mb-5">
            <GraficoPctCentros
              titulo="Costo mes a mes por centro de costo"
              meta={meta}
              datos={porMes.map(([m, b]) => ({ etiqueta: fmtMes(m), Cocina: cifras(b, "Cocina").pct, Bar: cifras(b, "Bar").pct, Global: cifras(b, "todos").pct }))}
            />
          </div>

          <div className="mb-5 grid gap-4 lg:grid-cols-2">
            {(["Cocina", "Bar"] as const).map((cc) => {
              const filas = porMesSede.map((x) => ({ ...x, c: cifras(x.b, cc) })).filter((x) => x.c.ventasBase > 0).sort((a, b) => b.c.ventasBase - a.c.ventasBase);
              return (
                <div key={cc} className="tarjeta overflow-hidden !p-0">
                  <div className="border-b border-linea px-4 py-3"><h2 className="text-sm font-semibold text-tinta">Detalle {cc}</h2><p className="text-xs text-texto-3">Por sede y mes, de mayor a menor venta</p></div>
                  <div className="max-h-[50vh] overflow-auto">
                    <table className="tabla">
                      <thead><tr><th>Mes / sede</th><th className="num">Ventas</th><th className="num">Mercancía vendida</th><th className="num">% Costo</th></tr></thead>
                      <tbody>
                        {filas.map((x) => (
                          <tr key={`${x.mes}-${x.sedeId}`}>
                            <td><span className="capitalize">{fmtMes(x.mes)}</span> · <span className="text-texto-2">{nombreSede(x.sedeId)}</span>{!x.c.completo && <span className="ml-1 text-[11px] text-alerta">(solo compras)</span>}</td>
                            <td className="num">{fmtNum(x.c.ventasBase)}</td>
                            <td className="num">{fmtNum(x.c.mv)}</td>
                            <td className="num"><PctMeta pct={x.c.pct} meta={meta} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="tarjeta overflow-hidden !p-0">
            <div className="border-b border-linea px-4 py-3">
              <h2 className="text-sm font-semibold text-tinta">Auditoría de centro de costo</h2>
              <p className="text-xs text-texto-3">Cómo llega la columna Centro de Costos en el Excel y cómo se clasifica. Sirve para detectar si un desbalance entre Cocina y Bar viene de cómo está etiquetado el dato de origen.</p>
            </div>
            <div className="max-h-[50vh] overflow-auto">
              <table className="tabla">
                <thead><tr><th>Hoja</th><th>Valor en el Excel</th><th>Se clasifica como</th><th className="num">Filas</th><th className="num">Total</th></tr></thead>
                <tbody>
                  {audit.map((a, i) => (
                    <tr key={i}>
                      <td>{a.tabla}</td><td className="text-texto-2">{a.valor}</td>
                      <td className={a.clasificado === "Excluido" ? "text-texto-3" : "font-medium"}>{a.clasificado === "Excluido" ? "Excluido del costo" : a.clasificado}</td>
                      <td className="num">{fmtNum(Number(a.filas))}</td><td className="num">{fmtNum(Number(a.total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
