"use client";

import { useState } from "react";
import { Encabezado } from "@/components/Encabezado";
import { useCP } from "@/components/cp/ContextoCP";
import { EtiquetaMarca, NavCP } from "@/components/cp/NavCP";
import { exportarExcel, fmtCant, Kpi, Seccion } from "@/components/cp/Comunes";
import { fmtFecha, fmtNum, fmtPesos } from "@/lib/formato";
import { aplicar, sum } from "@/lib/cp/motorCP";

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function ComprasCP() {
  const { datos: d, filtro } = useCP();
  const [q, setQ] = useState("");
  const [limite, setLimite] = useState(300);
  let filas = aplicar(d.compras, filtro).sort((a, b) => b.fecha.localeCompare(a.fecha));
  if (q) { const n = norm(q); filas = filas.filter((r) => norm(r.proveedor).includes(n) || norm(r.articulo).includes(n) || norm(r.familia).includes(n)); }
  return (
    <div>
      <Encabezado titulo="Compras del Centro de producción" descripcion="Solo compras de los almacenes CENTRO DE PRODUCCION (San Agustín) y PLANTA PRODUCCIÓN ROCOTO (Rocoto), sin duplicados." />
      <NavCP />
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Kpi titulo="Total compras" valor={fmtPesos(sum(filas, (r) => r.total))} sub={`${fmtNum(filas.length)} líneas`} />
        <Kpi titulo="San Agustín" valor={fmtPesos(sum(filas.filter((r) => r.marca === "San Agustín"), (r) => r.total))} />
        <Kpi titulo="Rocoto" valor={fmtPesos(sum(filas.filter((r) => r.marca === "Rocoto"), (r) => r.total))} />
      </div>
      <Seccion
        titulo="Detalle" nota="Ya deduplicado y filtrado al CP"
        accion={<div className="flex gap-2">
          <input className="campo w-72" type="search" placeholder="Buscar proveedor, artículo o familia" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="boton-sec" onClick={() => exportarExcel("compras_cp.xlsx", "Compras CP", filas.map((r) => ({ Fecha: r.fecha, Marca: r.marca, Almacén: r.almacen, Serie: r.serie, Proveedor: r.proveedor, Familia: r.familia, Artículo: r.articulo, Subartículo: r.subarticulo, Unidades: r.unidades, "Valor unitario": r.valor_unitario, Total: r.total })))}>Exportar Excel</button>
        </div>}
      >
        <div className="max-h-[65vh] overflow-auto">
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Marca</th><th>Serie</th><th>Proveedor</th><th>Familia</th><th>Artículo</th><th>Subartículo</th><th className="num">Uds.</th><th className="num">Valor unit.</th><th className="num">Total</th></tr></thead>
            <tbody>
              {filas.slice(0, limite).map((r, i) => (
                <tr key={i}>
                  <td>{fmtFecha(r.fecha)}</td><td><EtiquetaMarca marca={r.marca} /></td><td className="text-texto-2">{r.serie}</td>
                  <td className="max-w-[16rem] truncate" title={r.proveedor ?? ""}>{r.proveedor}</td><td className="text-texto-2">{r.familia}</td>
                  <td className="max-w-[18rem] truncate" title={r.articulo ?? ""}>{r.articulo}</td><td className="text-texto-2">{r.subarticulo}</td>
                  <td className="num">{fmtCant(r.unidades)}</td><td className="num">{fmtPesos(r.valor_unitario)}</td><td className="num">{fmtPesos(r.total)}</td>
                </tr>
              ))}
              {!filas.length && <tr><td colSpan={10} className="text-texto-3">Sin compras para este filtro.</td></tr>}
            </tbody>
          </table>
        </div>
        {filas.length > limite && <div className="border-t border-linea px-4 py-2 text-xs text-texto-2"><button className="boton-sec !h-8" onClick={() => setLimite((l) => l + 300)}>Mostrar más</button> Mostrando {fmtNum(limite)} de {fmtNum(filas.length)}</div>}
      </Seccion>
    </div>
  );
}
