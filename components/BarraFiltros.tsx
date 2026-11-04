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

export function BarraFiltros({ sinFechas = false, sinSede = false }: { sinFechas?: boolean; sinSede?: boolean }) {
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
    <div className="mb-4 flex flex-wrap items-end gap-3">
      {variasMarcas && (
        <label className="text-xs text-stone-500">
          <span className="mb-1 block">Marca</span>
          <select
            className="campo"
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
        <label className="text-xs text-stone-500">
          <span className="mb-1 block">Sede</span>
          <select
            className="campo"
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
      {!sinFechas && (
        <>
          <label className="text-xs text-stone-500">
            <span className="mb-1 block">Mes</span>
            <select className="campo" value={valorSelect} onChange={(e) => elegirMes(e.target.value)}>
              <option value="personalizado" disabled>Rango personalizado</option>
              {todo && <option value="todo">Todos los meses con datos</option>}
              {meses.length >= 3 && <option value="trimestre">Últimos 3 meses con datos</option>}
              {meses.map((m) => (
                <option key={m} value={m}>{nombreMes(m)}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-stone-500">
            <span className="mb-1 block">Desde</span>
            <input type="date" className="campo" value={filtros.desde} onChange={(e) => setFiltros({ desde: e.target.value })} />
          </label>
          <label className="text-xs text-stone-500">
            <span className="mb-1 block">Hasta</span>
            <input type="date" className="campo" value={filtros.hasta} onChange={(e) => setFiltros({ hasta: e.target.value })} />
          </label>
        </>
      )}
    </div>
  );
}
