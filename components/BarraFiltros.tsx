"use client";

import { useApp } from "./Contexto";

export function BarraFiltros({ sinFechas = false, sinSede = false }: { sinFechas?: boolean; sinSede?: boolean }) {
  const { perfil, marcas, sedes, filtros, setFiltros, variasMarcas } = useApp();
  const sedesMarca = sedes.filter((s) => filtros.marcaId == null || s.marca_id === filtros.marcaId);

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
