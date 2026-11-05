"use client";

import { useApp } from "@/components/Contexto";
import { BarraFiltros } from "@/components/BarraFiltros";
import { Encabezado } from "@/components/Encabezado";
import { notaConteo, notaMV, PctMeta, Tarjeta } from "@/components/Indicadores";
import { ListaBarras } from "@/components/ListaBarras";
import { fmtM, fmtNum, fmtPct, fmtPesos } from "@/lib/formato";
import { cifras, type Bloque } from "@/lib/rentabilidad";
import { useCostos } from "@/lib/useCostos";

type Fila = { nombre: string; cc: "Cocina" | "Bar" | "Total"; ini: number; com: number; fin: number; mv: number; ventas: number; util: number; pct: number | null; completo: boolean };

export default function Mercancia() {
  const { filtros, meta, marcas } = useApp();
  const { cargando, total, porSede, sedePorId } = useCostos();
  const g = cifras(total, "todos");
  const marcaNombre = (id: number) => marcas.find((m) => m.id === id)?.nombre ?? "";
  const nombreSede = (id: number) => {
    const s = sedePorId.get(id);
    return s ? (filtros.marcaId == null ? `${marcaNombre(s.marca_id)} · ${s.nombre}` : s.nombre) : `Sede ${id}`;
  };

  const filasDe = (nombre: string, b: Bloque): Fila[] =>
    (["Cocina", "Bar", "Total"] as const).map((cc) => {
      const c = cifras(b, cc === "Total" ? "todos" : cc);
      return { nombre, cc, ini: c.invIni, com: c.compras + c.traslados, fin: c.invFin, mv: c.mv, ventas: c.ventasBase, util: c.utilidad, pct: c.pct, completo: c.completo };
    }).filter((f) => f.ventas || f.com || f.ini || f.fin);

  const varias = porSede.length > 1;
  const filas: Fila[] = varias
    ? porSede.sort((a, b) => nombreSede(a[0]).localeCompare(nombreSede(b[0]))).flatMap(([id, b]) => filasDe(nombreSede(id), b))
    : filasDe("Todas", total);

  async function exportar() {
    const XLSX = await import("xlsx");
    const datos = filas.map((r) => ({
      Sede: r.nombre, "Centro de costos": r.cc, "Inv inicial": Math.round(r.ini), Compras: Math.round(r.com), "Inv final": Math.round(r.fin),
      "Mercancía vendida": Math.round(r.mv), "Ventas base": Math.round(r.ventas), "Utilidad bruta": Math.round(r.util),
      "Costo mercancía vendida": r.pct == null ? null : Math.round(r.pct * 10000) / 10000, Cálculo: r.completo ? "Juego de inventarios" : "Solo compras",
    }));
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mercancía vendida");
    XLSX.writeFile(wb, `mercancia-vendida_${filtros.desde}_${filtros.hasta}.xlsx`);
  }

  return (
    <div>
      <Encabezado
        titulo="Mercancía vendida"
        descripcion={<>Juego de inventarios: inventario inicial + compras de Cocina y Bar (y traslados) − inventario final. Costo = mercancía vendida ÷ ventas base. Meta: {fmtPct(meta)}.</>}
      />
      <BarraFiltros sinCC />
      {cargando ? <p className="text-sm text-texto-2">Cargando…</p> : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <Tarjeta titulo="Inventario inicial" valor={fmtM(g.invIni)} exacto={fmtPesos(g.invIni)} nota={notaConteo(g, "ini")} />
            <Tarjeta titulo="Compras" valor={fmtM(g.compras + g.traslados)} exacto={fmtPesos(g.compras + g.traslados)} nota="Solo Cocina y Bar" />
            <Tarjeta titulo="Inventario final" valor={fmtM(g.invFin)} exacto={fmtPesos(g.invFin)} nota={notaConteo(g, "fin")} />
            <Tarjeta titulo="Mercancía vendida" valor={fmtM(g.mv)} exacto={fmtPesos(g.mv)} nota={notaMV(g)} />
            <Tarjeta titulo="Ventas base" valor={fmtM(g.ventasBase)} exacto={fmtPesos(g.ventasBase)} nota="Sin IVA ni propinas" />
            <Tarjeta titulo="Costo mercancía vendida" valor={fmtPct(g.pct)} exacto={fmtPesos(g.mv)} tono={g.pct != null && g.pct > meta ? "alerta" : "bien"} nota={g.pct != null && g.pct > meta ? "Por encima de la meta" : "Dentro de la meta"} />
            <Tarjeta titulo="Utilidad bruta" valor={fmtM(g.utilidad)} exacto={fmtPesos(g.utilidad)} nota={`${fmtPct(g.pctUtil)} sobre las ventas`} />
          </div>
          <div className="mb-5 grid gap-3 lg:grid-cols-2">
            <ListaBarras titulo="Mercancía vendida por centro de costo" filas={(["Cocina", "Bar"] as const).map((cc) => ({ k: cc, v: cifras(total, cc).mv }))} formato={fmtM} />
            <ListaBarras titulo="Costo de mercancía vendida % por centro" filas={(["Cocina", "Bar"] as const).map((cc) => { const p = cifras(total, cc).pct ?? 0; return { k: cc, v: p, alerta: p > meta }; })} formato={(v) => fmtPct(v)} />
          </div>
          <div className="tarjeta overflow-hidden !p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linea px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-tinta">Juego de inventarios</h2>
                <p className="text-xs text-texto-3">{varias ? "Por sede y centro de costo" : "Por centro de costo"} · pesos</p>
              </div>
              <button className="boton-sec" onClick={exportar} disabled={!filas.length}>Exportar a Excel</button>
            </div>
            <div className="overflow-auto">
              <table className="tabla">
                <thead>
                  <tr>{varias && <th>Sede</th>}<th>Centro de costo</th><th className="num">Inv. inicial</th><th className="num">Compras</th><th className="num">Inv. final</th><th className="num">Mercancía vendida</th><th className="num">Ventas base</th><th className="num">Utilidad bruta</th><th className="num">Costo M.V.</th></tr>
                </thead>
                <tbody>
                  {filas.map((r, i) => (
                    <tr key={i} className={r.cc === "Total" ? "grupo" : ""}>
                      {varias && <td className={r.cc === "Total" ? "" : "text-texto-2"}>{r.cc === "Total" || i === 0 || filas[i - 1].nombre !== r.nombre ? r.nombre : ""}</td>}
                      <td>{r.cc}{!r.completo && r.cc !== "Total" && <span className="ml-1 text-[11px] text-alerta">(solo compras)</span>}</td>
                      <td className="num">{fmtNum(r.ini)}</td><td className="num">{fmtNum(r.com)}</td><td className="num">{fmtNum(r.fin)}</td>
                      <td className="num font-medium">{fmtNum(r.mv)}</td><td className="num">{fmtNum(r.ventas)}</td><td className="num">{fmtNum(r.util)}</td>
                      <td className="num"><PctMeta pct={r.pct} meta={meta} /></td>
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
