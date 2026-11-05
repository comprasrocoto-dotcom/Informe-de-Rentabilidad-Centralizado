"use client";

import { useState } from "react";
import { Encabezado } from "@/components/Encabezado";
import { useCP } from "@/components/cp/ContextoCP";
import { EtiquetaMarca, NavCP } from "@/components/cp/NavCP";
import { exportarExcel, Kpi, Seccion } from "@/components/cp/Comunes";
import { fmtNum, fmtPct, fmtPesos } from "@/lib/formato";
import { aplicar, sum } from "@/lib/cp/motorCP";

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function TrasladosCP() {
  const { datos: d, filtro } = useCP();
  const [q, setQ] = useState("");
  let filas = aplicar(d.tras, filtro);
  if (q) { const n = norm(q); filas = filas.filter((r) => norm(r.articulo).includes(n) || norm(r.sede_destino).includes(n)); }
  const total = sum(filas, (r) => r.costo);
  const porSede = new Map<string, { valor: number; marca: string; n: number }>();
  filas.forEach((r) => { const k = r.sede_destino ?? "(sin sede)"; const o = porSede.get(k) ?? { valor: 0, marca: r.marca, n: 0 }; o.valor += r.costo; o.n++; porSede.set(k, o); });
  const sedes = [...porSede.entries()].sort((a, b) => b[1].valor - a[1].valor);
  return (
    <div>
      <Encabezado titulo="Traslados del CP a las sedes" descripcion="Envíos de sub-recetas e insumos del Centro de producción y la Planta a los puntos de venta." />
      <NavCP />
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Kpi titulo="Valor total trasladado" valor={fmtPesos(total)} sub={`${fmtNum(filas.length)} líneas`} />
        <Kpi titulo="San Agustín" valor={fmtPesos(sum(filas.filter((r) => r.marca === "San Agustín"), (r) => r.costo))} />
        <Kpi titulo="Rocoto" valor={fmtPesos(sum(filas.filter((r) => r.marca === "Rocoto"), (r) => r.costo))} />
      </div>
      <Seccion
        titulo="Por sede destino"
        accion={<div className="flex gap-2">
          <input className="campo w-64" type="search" placeholder="Buscar artículo o sede" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="boton-sec" onClick={() => exportarExcel("traslados_cp.xlsx", "Traslados CP", filas.map((r) => ({ Fecha: r.fecha, Marca: r.marca, Serie: r.serie, Sede: r.sede_destino, Artículo: r.articulo, Unidad: r.unidad, Cantidad: r.cantidad, Valor: r.costo })))}>Exportar Excel</button>
        </div>}
      >
        <table className="tabla">
          <thead><tr><th>Sede</th><th>Marca</th><th className="num">Líneas</th><th className="num">Valor</th><th className="num">% del total</th></tr></thead>
          <tbody>
            {sedes.map(([s, v]) => <tr key={s}><td className="font-medium">{s}</td><td><EtiquetaMarca marca={v.marca} /></td><td className="num">{fmtNum(v.n)}</td><td className="num">{fmtPesos(v.valor)}</td><td className="num">{fmtPct(total ? v.valor / total : null)}</td></tr>)}
            {!sedes.length && <tr><td colSpan={5} className="text-texto-3">Sin traslados para este filtro.</td></tr>}
          </tbody>
        </table>
      </Seccion>
    </div>
  );
}
