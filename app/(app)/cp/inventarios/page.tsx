"use client";

import { useState } from "react";
import { Encabezado } from "@/components/Encabezado";
import { useCP } from "@/components/cp/ContextoCP";
import { EtiquetaMarca, NavCP } from "@/components/cp/NavCP";
import { Aviso, exportarExcel, fmtCant, fmtKg, Kpi, Seccion } from "@/components/cp/Comunes";
import { fmtPesos } from "@/lib/formato";
import { aplicar, etiquetaMes, kardexMesMarca, kardexProductos, MARCAS_CP, sum, type Estado, type FilaKardex } from "@/lib/cp/motorCP";
import type { MarcaCP } from "@/lib/cp/importadorCP";

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const COLOR_ESTADO: Record<Estado, string> = { bien: "bg-[#e8f5e9] text-bien", manejable: "bg-[#fff8e1] text-[#8d6e00]", "muy elevado": "bg-[#ffebee] text-alerta" };

function Semaforo({ e }: { e: Estado | null }) {
  if (!e) return <span className="text-texto-3">—</span>;
  return <span className={`inline-block rounded-sm px-1.5 py-0.5 text-[11px] font-medium ${COLOR_ESTADO[e]}`}>{e === "bien" ? "Bien" : e === "manejable" ? "Manejable" : "Muy elevado"}</span>;
}

export default function InventariosCP() {
  const { datos: d, filtro, meses, conv } = useCP();
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<"Todos" | Estado>("Todos");
  const [enKg, setEnKg] = useState(false);
  const inv = aplicar(d.inv, filtro);
  const kardex = kardexMesMarca(d, filtro);
  const mesesInv = meses.filter((m) => d.inv.some((r) => r.mes === m));
  const mesProd = filtro.mes !== "Todos" ? filtro.mes : mesesInv[mesesInv.length - 1];
  const marcas: MarcaCP[] = filtro.marca === "Todas" ? MARCAS_CP : [filtro.marca];
  const prods = (m: MarcaCP) => (mesProd ? kardexProductos(d, mesProd, m, conv) : [])
    .filter((r) => r.articulo.startsWith("SUB") && r.estado !== null)
    .filter((r) => estado === "Todos" || r.estado === estado)
    .filter((r) => !q || norm(r.articulo).includes(norm(q)));
  const v = (r: FilaKardex, c: "inicial" | "fabricado" | "trasladado" | "esperado" | "finalReal" | "variacion") => {
    if (!enKg) return fmtCant(r[c]);
    return r.convertible ? fmtKg(r.kg[c]) : `${fmtCant(r[c])} ${r.unidad}`;
  };

  return (
    <div>
      <Encabezado titulo="Inventarios y kardex" descripcion="Cuadre del inventario del CP: lo que debería haber quedado contra lo que realmente se contó." />
      <NavCP />
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Kpi titulo="Inventario final" valor={fmtPesos(sum(inv, (r) => r.total))} sub={filtro.mes === "Todos" ? "Suma de todos los cortes" : etiquetaMes(filtro.mes)} />
        <Kpi titulo="San Agustín" valor={fmtPesos(sum(inv.filter((r) => r.marca === "San Agustín"), (r) => r.total))} />
        <Kpi titulo="Rocoto" valor={fmtPesos(sum(inv.filter((r) => r.marca === "Rocoto"), (r) => r.total))} />
      </div>
      <div className="mb-4"><Aviso>Final esperado = Inventario inicial (el final del mes anterior) + Compras − Traslados. La fabricación se muestra como referencia: transforma insumos en sub-recetas dentro del mismo inventario, por eso no suma ni resta en pesos.</Aviso></div>

      <Seccion titulo="Kardex en pesos por mes y marca">
        <div className="overflow-auto">
          <table className="tabla">
            <thead><tr><th>Mes</th><th>Marca</th><th className="num">Inicial</th><th className="num">+ Compras</th><th className="num">Fabricación (ref.)</th><th className="num">− Traslados</th><th className="num">Final esperado</th><th className="num">Final real</th><th className="num">Diferencia</th></tr></thead>
            <tbody>
              {kardex.map((k) => (
                <tr key={k.mes + k.marca}>
                  <td>{etiquetaMes(k.mes)}</td><td><EtiquetaMarca marca={k.marca} /></td>
                  <td className="num">{k.inicial === null ? <span className="text-texto-3">sin mes anterior</span> : fmtPesos(k.inicial)}</td>
                  <td className="num">{fmtPesos(k.compras)}</td><td className="num text-texto-2">{fmtPesos(k.fab)}</td><td className="num">{fmtPesos(k.tras)}</td>
                  <td className="num">{k.esperado === null ? "—" : fmtPesos(k.esperado)}</td><td className="num font-medium">{fmtPesos(k.finalTotal)}</td>
                  <td className={`num ${k.diferencia !== null && k.diferencia < 0 ? "text-alerta" : ""}`}>{k.diferencia === null ? "—" : fmtPesos(k.diferencia)}</td>
                </tr>
              ))}
              {!kardex.length && <tr><td colSpan={9} className="text-texto-3">Sin inventarios cargados para este filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion
        titulo={`Kardex de sub-recetas${mesProd ? ` · ${etiquetaMes(mesProd)}` : ""}`}
        nota={<>Inicial + Fabricado − Trasladado = Final esperado, contra el conteo real. Semáforo: ≤5 % bien · ≤20 % manejable · &gt;20 % muy elevado.{filtro.mes === "Todos" && " Se muestra el último mes con inventario; elige un mes arriba para ver otro."}</>}
        accion={<div className="flex flex-wrap gap-2">
          <input className="campo w-56" type="search" placeholder="Buscar sub-receta" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="campo" value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)}>
            <option value="Todos">Todos los estados</option><option value="bien">Bien</option><option value="manejable">Manejable</option><option value="muy elevado">Muy elevado</option>
          </select>
          <button className={enKg ? "boton" : "boton-sec"} onClick={() => setEnKg((x) => !x)}>{enKg ? "Ver en unidad original" : "Ver en kilos"}</button>
          <button className="boton-sec" onClick={() => exportarExcel(`kardex_subrecetas_${mesProd}.xlsx`, "Kardex", marcas.flatMap((m) => prods(m).map((r) => ({ Marca: m, Artículo: r.articulo, Unidad: r.unidad, Inicial: r.inicial, Fabricado: r.fabricado, Trasladado: r.trasladado, "Final esperado": r.esperado, "Final real": r.finalReal, Variación: r.variacion, Estado: r.estado }))))}>Exportar Excel</button>
        </div>}
      >
        {!mesProd ? <div className="p-4"><Aviso tono="vacio">Sube inventarios para ver el kardex por producto.</Aviso></div> : (
          <div className={`grid gap-0 ${marcas.length > 1 ? "2xl:grid-cols-2" : ""}`}>
            {marcas.map((m) => {
              const filas = prods(m);
              return (
                <div key={m} className="min-w-0 border-linea 2xl:[&:not(:first-child)]:border-l">
                  <h3 className="flex items-center gap-2 px-4 pt-3 pb-2 text-sm font-medium"><EtiquetaMarca marca={m} /> <span className="text-texto-3 font-normal">{filas.length} sub-recetas</span></h3>
                  <div className="max-h-[60vh] overflow-auto">
                    <table className="tabla">
                      <thead><tr><th>Sub-receta</th><th className="num">Inicial</th><th className="num">+ Fabr.</th><th className="num">− Trasl.</th><th className="num">Esperado</th><th className="num">Real</th><th className="num">Variación</th><th>Estado</th></tr></thead>
                      <tbody>
                        {filas.map((r) => (
                          <tr key={r.articulo}>
                            <td className="max-w-[16rem] truncate" title={r.articulo}>{r.articulo}{!enKg && <span className="ml-1 text-texto-3">{r.unidad}</span>}</td>
                            <td className="num">{v(r, "inicial")}</td><td className="num">{v(r, "fabricado")}</td><td className="num">{v(r, "trasladado")}</td>
                            <td className="num">{v(r, "esperado")}</td><td className="num">{v(r, "finalReal")}</td>
                            <td className={`num ${(r.variacion ?? 0) < 0 ? "text-alerta" : ""}`}>{v(r, "variacion")}</td><td><Semaforo e={r.estado} /></td>
                          </tr>
                        ))}
                        {!filas.length && <tr><td colSpan={8} className="text-texto-3">Sin sub-recetas con datos de dos meses seguidos.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Seccion>
    </div>
  );
}
