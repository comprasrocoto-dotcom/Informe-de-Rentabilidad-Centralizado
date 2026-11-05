"use client";

import { useEffect, useState } from "react";
import { useApp } from "./Contexto";

const NOMBRES_MES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const finDeMes = (inicio: string) => {
  const [y, m] = inicio.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
const nombreMes = (inicio: string) => {
  const [y, m] = inicio.split("-").map(Number);
  return `${NOMBRES_MES[m - 1]} ${y}`;
};

export function BarraFiltros({ sinFechas = false, sinSede = false, sinCC = false }: { sinFechas?: boolean; sinSede?: boolean; sinCC?: boolean }) {
  const { perfil, marcas, sedes, filtros, setFiltros, variasMarcas, sb } = useApp();
  const sedesMarca = sedes.filter((s) => filtros.marcaId == null || s.marca_id === filtros.marcaId);
  const [meses, setMeses] = useState<string[]>([]);

  useEffect(() => {
    if (sinFechas) return;
    let vivo = true;
    sb.rpc("meses_disponibles", { p_marca: filtros.marcaId }).then(({ data }) => {
      if (vivo) setMeses(((data as { mes: string }[]) ?? []).map((x) => x.mes));
    });
    return () => { vivo = false; };
  }, [sb, filtros.marcaId, sinFechas]);

  // El mes queda seleccionado si Desde/Hasta cubren exactamente ese mes
  const mesActual = filtros.desde.endsWith("-01") && filtros.hasta === finDeMes(filtros.desde) ? filtros.desde : "";
  const ultimosMeses = meses.slice(0, 3);
  const trimestre = ultimosMeses.length ? { desde: ultimosMeses[ultimosMeses.length - 1], hasta: finDeMes(ultimosMeses[0]) } : null;
  const todo = meses.length ? { desde: meses[meses.length - 1], hasta: finDeMes(meses[0]) } : null;

  function elegirMes(valor: string) {
    if (valor === "todo" && todo) setFiltros(todo);
    else if (valor === "trimestre" && trimestre) setFiltros(trimestre);
    else if (valor) setFiltros({ desde: valor, hasta: finDeMes(valor) });
  }

  const valorSelect =
    mesActual ||
    (todo && filtros.desde === todo.desde && filtros.hasta === todo.hasta ? "todo" : "") ||
    (trimestre && filtros.desde === trimestre.desde && filtros.hasta === trimestre.hasta ? "trimestre" : "") ||
    "personalizado";

  return (
    <div className="sticky top-[52px] z-20 -mx-4 mb-5 flex flex-wrap items-end gap-3 border-y border-linea bg-fondo/95 px-4 py-3 backdrop-blur lg:top-0 lg:-mx-8 lg:px-8">
      {variasMarcas && (
        <label>
          <span className="etiqueta">Marca</span>
          <select
            className="campo w-44"
            value={filtros.marcaId ?? ""}
            onChange={(e) => setFiltros({ marcaId: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">{perfil.rol === "admin" ? "Todas las marcas" : "Todas mis marcas"}</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
        </label>
      )}
      {!sinSede && (
        <label>
          <span className="etiqueta">Sede</span>
          <select
            className="campo w-52"
            value={filtros.sedeId ?? ""}
            onChange={(e) => setFiltros({ sedeId: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Todas las sedes</option>
            {sedesMarca.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}{s.tipo === "produccion" ? " (producción)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {!sinCC && (
        <div>
          <span className="etiqueta">Centro de costo</span>
          <div className="flex h-9 overflow-hidden rounded-md border border-linea bg-white text-sm" role="group">
            {(["todos", "Cocina", "Bar"] as const).map((c) => (
              <button
                key={c} type="button" onClick={() => setFiltros({ cc: c })} aria-pressed={filtros.cc === c}
                className={`px-3 ${filtros.cc === c ? "bg-marca font-medium text-white" : "text-texto-2 hover:bg-fondo"} ${c !== "todos" ? "border-l border-linea" : ""}`}
              >
                {c === "todos" ? "Todos" : c}
              </button>
            ))}
          </div>
        </div>
      )}
      {!sinFechas && (
        <>
          <label>
            <span className="etiqueta">Mes</span>
            <select className="campo w-44" value={valorSelect} onChange={(e) => elegirMes(e.target.value)}>
              <option value="personalizado" disabled>Rango personalizado</option>
              {todo && <option value="todo">Todos los meses</option>}
              {meses.length >= 3 && <option value="trimestre">Últimos 3 meses</option>}
              {meses.map((m) => (
                <option key={m} value={m}>{nombreMes(m)}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="etiqueta">Desde</span>
            <input type="date" className="campo w-36" value={filtros.desde} onChange={(e) => setFiltros({ desde: e.target.value })} />
          </label>
          <label>
            <span className="etiqueta">Hasta</span>
            <input type="date" className="campo w-36" value={filtros.hasta} onChange={(e) => setFiltros({ hasta: e.target.value })} />
          </label>
        </>
      )}
    </div>
  );
}
