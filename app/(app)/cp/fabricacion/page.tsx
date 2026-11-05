"use client";

import { useState } from "react";
import { Encabezado } from "@/components/Encabezado";
import { useCP } from "@/components/cp/ContextoCP";
import { EtiquetaMarca, NavCP } from "@/components/cp/NavCP";
import { Aviso, BarrasMarca, fmtCant, fmtKg, Kpi, Seccion } from "@/components/cp/Comunes";
import { fmtNum, fmtPesos } from "@/lib/formato";
import { aplicar, etiquetaMes, participacionKilos, sum, type Fab } from "@/lib/cp/motorCP";

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function FabricacionCP() {
  const { datos: d, filtro, conv } = useCP();
  const [q, setQ] = useState("");
  const buscar = (rows: Fab[]) => (q ? rows.filter((r) => norm(r.artifabri).includes(norm(q)) || norm(r.codigo).includes(norm(q))) : rows);
  const filas = buscar(aplicar(d.fab, filtro));
  // La participación en kilos usa las dos marcas del mes, sin importar el filtro de marca
  const paraKg = filtro.mes === "Todos" ? d.fab : d.fab.filter((r) => r.mes === filtro.mes);
  const part = participacionKilos(paraKg, conv.aKg);

  const porRef = new Map<string, { codigo: string | null; nombre: string | null; marca: string; kg: number }>();
  const sinConv = new Map<string, { codigo: string | null; nombre: string | null; marca: string; unidad: string | null; qty: number; costo: number }>();
  buscar(paraKg).forEach((r) => {
    const kg = conv.aKg(r.codigo, r.artifabri, r.cantidad);
    const k = `${r.codigo}|${r.marca}`;
    if (kg === null) {
      const o = sinConv.get(k) ?? { codigo: r.codigo, nombre: r.artifabri, marca: r.marca, unidad: r.unidad, qty: 0, costo: 0 };
      o.qty += r.cantidad; o.costo += r.costo; sinConv.set(k, o); return;
    }
    const o = porRef.get(k) ?? { codigo: r.codigo, nombre: r.artifabri, marca: r.marca, kg: 0 };
    o.kg += kg; porRef.set(k, o);
  });
  const top = new Map<string, { costo: number; marca: string }>();
  filas.forEach((r) => { const k = r.artifabri ?? "(sin nombre)"; const o = top.get(k) ?? { costo: 0, marca: r.marca }; o.costo += r.costo; top.set(k, o); });

  return (
    <div>
      <Encabezado titulo="Fabricación" descripcion="Producción del CP. Los kilos salen de la cantidad fabricada × Base de conversión (gramos ÷ factor, o unidades × gramos por unidad ÷ 1.000)." />
      <NavCP />
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Kpi titulo="Costo total insumos" valor={fmtPesos(sum(filas, (r) => r.costo))} sub={`${fmtNum(filas.length)} líneas`} />
        <Kpi titulo="San Agustín" valor={fmtPesos(sum(filas.filter((r) => r.marca === "San Agustín"), (r) => r.costo))} />
        <Kpi titulo="Rocoto" valor={fmtPesos(sum(filas.filter((r) => r.marca === "Rocoto"), (r) => r.costo))} />
      </div>
      <div className="mb-4 flex justify-end"><input className="campo w-72" type="search" placeholder="Buscar producto o código" value={q} onChange={(e) => setQ(e.target.value)} /></div>

      <Seccion titulo={`Participación en kilos preparados${filtro.mes !== "Todos" ? ` · ${etiquetaMes(filtro.mes)}` : ""}`} nota="Fabricación × Base de conversión. Es el % que usa la Liquidación (ambas marcas, sin filtro de marca).">
        <BarrasMarca sa={part.kgSA} ro={part.kgRO} formato={fmtKg} pct={[part.pctSA, part.pctRO]} />
        {part.sinConvN > 0 && <div className="px-4 pb-4"><Aviso>{fmtNum(part.sinConvN)} líneas sin conversión a kilos (costo {fmtPesos(part.sinConvCosto)}) no entran en el %. Agrégalas a la hoja Base_Conversion para incluirlas.</Aviso></div>}
      </Seccion>

      <div className="grid gap-4 lg:grid-cols-2">
        <Seccion titulo="Kilos fabricados por referencia" nota="Solo códigos con conversión en Base_Conversion">
          <div className="max-h-[55vh] overflow-auto">
            <table className="tabla">
              <thead><tr><th>Código</th><th>Producto</th><th>Marca</th><th className="num">Kilos</th></tr></thead>
              <tbody>
                {[...porRef.values()].sort((a, b) => b.kg - a.kg).map((f, i) => (
                  <tr key={i}><td className="text-texto-2">{f.codigo}</td><td>{f.nombre}</td><td><EtiquetaMarca marca={f.marca} /></td><td className="num">{fmtKg(f.kg)}</td></tr>
                ))}
              </tbody>
            </table>
            {sinConv.size > 0 && (
              <>
                <p className="px-4 pt-4 pb-1 text-xs text-texto-2">Sin conversión a kilos (en su unidad original):</p>
                <table className="tabla">
                  <thead><tr><th>Código</th><th>Producto</th><th>Marca</th><th className="num">Cantidad</th><th>Unidad</th><th className="num">Costo</th></tr></thead>
                  <tbody>
                    {[...sinConv.values()].sort((a, b) => b.costo - a.costo).map((f, i) => (
                      <tr key={i}><td className="text-texto-2">{f.codigo}</td><td>{f.nombre}</td><td><EtiquetaMarca marca={f.marca} /></td><td className="num">{fmtCant(f.qty)}</td><td>{f.unidad}</td><td className="num">{fmtPesos(f.costo)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </Seccion>
        <Seccion titulo="Costo por producto fabricado (top 25)" nota="Suma de Coste variación por producto">
          <table className="tabla">
            <thead><tr><th>Marca</th><th>Producto</th><th className="num">Costo insumos</th></tr></thead>
            <tbody>
              {[...top.entries()].sort((a, b) => b[1].costo - a[1].costo).slice(0, 25).map(([n, v]) => (
                <tr key={n}><td><EtiquetaMarca marca={v.marca} /></td><td>{n}</td><td className="num">{fmtPesos(v.costo)}</td></tr>
              ))}
            </tbody>
          </table>
        </Seccion>
      </div>
    </div>
  );
}
