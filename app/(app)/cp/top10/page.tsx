"use client";

import { Encabezado } from "@/components/Encabezado";
import { useCP } from "@/components/cp/ContextoCP";
import { EtiquetaMarca, NavCP } from "@/components/cp/NavCP";
import { Aviso, fmtCant, fmtKg, Seccion } from "@/components/cp/Comunes";
import { fmtNum, fmtPesos } from "@/lib/formato";
import { aplicar, normArt } from "@/lib/cp/motorCP";

function top<T>(rows: T[], k: (r: T) => string, v: (r: T) => number) {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(k(r), (m.get(k(r)) ?? 0) + v(r)));
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
}
function Tabla({ filas, col, fmt }: { filas: [string, number][]; col: string; fmt: (n: number) => string }) {
  if (!filas.length) return <p className="p-4 text-sm text-texto-3">Sin datos para este filtro.</p>;
  return (
    <table className="tabla">
      <thead><tr><th className="w-10">#</th><th>{col}</th><th className="num">Valor</th></tr></thead>
      <tbody>{filas.map(([k, v], i) => <tr key={k}><td className="text-texto-3">{i + 1}</td><td className="max-w-[22rem] truncate" title={k}>{k}</td><td className="num">{fmt(v)}</td></tr>)}</tbody>
    </table>
  );
}

export default function Top10CP() {
  const { datos: d, filtro, conv } = useCP();
  const compras = aplicar(d.compras, filtro), fab = aplicar(d.fab, filtro);
  const kg = new Map<string, number>();
  let sinConv = 0;
  fab.forEach((r) => { const x = conv.aKg(r.codigo, r.artifabri, r.cantidad); if (x === null) { sinConv++; return; } const k = r.artifabri ?? "(sin nombre)"; kg.set(k, (kg.get(k) ?? 0) + x); });
  // Sub-recetas (artículos que empiezan por "SUB") trasladadas a los puntos de venta: cantidad real
  const subs = new Map<string, { articulo: string; marca: string; unidad: string | null; cantidad: number }>();
  aplicar(d.tras, filtro).filter((r) => normArt(r.articulo).startsWith("SUB")).forEach((r) => {
    const k = `${normArt(r.articulo)}|${r.marca}`;
    const o = subs.get(k) ?? { articulo: r.articulo ?? "", marca: r.marca, unidad: r.unidad, cantidad: 0 };
    o.cantidad += r.cantidad; subs.set(k, o);
  });
  const lista = [...subs.values()];
  const mas = [...lista].sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);
  const menos = lista.filter((x) => x.cantidad > 0).sort((a, b) => a.cantidad - b.cantidad).slice(0, 10);
  const TablaSubs = ({ filas }: { filas: typeof lista }) => (
    <table className="tabla">
      <thead><tr><th className="w-10">#</th><th>Artículo</th><th>Marca</th><th>Unidad</th><th className="num">Cantidad</th></tr></thead>
      <tbody>{filas.map((r, i) => <tr key={r.articulo + r.marca}><td className="text-texto-3">{i + 1}</td><td>{r.articulo}</td><td><EtiquetaMarca marca={r.marca} /></td><td className="text-texto-2">{r.unidad ?? "—"}</td><td className="num">{fmtCant(r.cantidad)}</td></tr>)}</tbody>
    </table>
  );
  return (
    <div>
      <Encabezado titulo="Top 10" />
      <NavCP />
      <div className="grid gap-4 lg:grid-cols-2">
        <Seccion titulo="Top 10 proveedores" nota="Por monto de compras"><Tabla filas={top(compras, (r) => r.proveedor ?? "(sin proveedor)", (r) => r.total)} col="Proveedor" fmt={fmtPesos} /></Seccion>
        <Seccion titulo="Top 10 productos más comprados" nota="Por monto de compras"><Tabla filas={top(compras, (r) => r.articulo ?? "(sin artículo)", (r) => r.total)} col="Artículo" fmt={fmtPesos} /></Seccion>
      </div>
      <Seccion titulo="Top 10 productos que más se fabrican" nota="Por kilos (solo códigos con conversión en Base_Conversion)">
        <Tabla filas={[...kg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)} col="Producto" fmt={fmtKg} />
        {sinConv > 0 && <p className="px-4 pb-3 text-xs text-texto-3">{fmtNum(sinConv)} líneas de fabricación no entran a este ranking por no tener conversión a kilos.</p>}
      </Seccion>
      <Seccion titulo="Sub-recetas más y menos trasladadas a puntos de venta" nota="Cantidad real que salió del CP hacia las sedes, en la unidad de inventario de cada producto">
        {lista.length === 0 ? <div className="p-4"><Aviso tono="vacio">Sin sub-recetas trasladadas para este filtro.</Aviso></div> : (
          <div className="grid gap-4 p-0 lg:grid-cols-2">
            <div><h3 className="px-4 pt-3 pb-2 text-sm font-medium">Más trasladadas</h3><TablaSubs filas={mas} /></div>
            <div><h3 className="px-4 pt-3 pb-2 text-sm font-medium">Menos trasladadas</h3><TablaSubs filas={menos} /></div>
          </div>
        )}
      </Seccion>
    </div>
  );
}
