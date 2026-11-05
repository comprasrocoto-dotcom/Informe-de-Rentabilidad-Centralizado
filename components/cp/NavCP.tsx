"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCP } from "./ContextoCP";
import { useApp } from "@/components/Contexto";
import { etiquetaMes } from "@/lib/cp/motorCP";

export const PESTANAS_CP = [
  { href: "/cp", texto: "Resumen global" },
  { href: "/cp/compras", texto: "Compras" },
  { href: "/cp/fabricacion", texto: "Fabricación" },
  { href: "/cp/traslados", texto: "Traslados" },
  { href: "/cp/inventarios", texto: "Juego de inventarios" },
  { href: "/cp/liquidacion", texto: "Liquidación SA vs RO" },
  { href: "/cp/top10", texto: "Top 10" },
  { href: "/cp/cargar", texto: "Cargar archivo" },
];

/** Pestañas al estilo del ERP + filtros de mes y marca del CP */
export function NavCP({ sinFiltros = false }: { sinFiltros?: boolean }) {
  const ruta = usePathname();
  const { filtro, setFiltro, meses } = useCP();
  const { perfil } = useApp();
  // Subir o borrar datos del CP es solo del administrador; las marcas lo consultan
  const pestanas = perfil.rol === "admin" ? PESTANAS_CP : PESTANAS_CP.filter((p) => p.href !== "/cp/cargar");
  return (
    <div className="sticky top-9 z-20 -mx-4 mb-5 bg-white lg:-mx-8">
      <nav className="flex overflow-x-auto border-b-2 border-celeste px-4 lg:px-8" aria-label="Pestañas del Centro de producción">
        {pestanas.map((p) => {
          const on = p.href === "/cp" ? ruta === "/cp" : ruta.startsWith(p.href);
          return (
            <Link
              key={p.href} href={p.href} aria-current={on ? "page" : undefined}
              className={`border-t-2 px-5 py-2.5 text-sm whitespace-nowrap ${on ? "border-marca bg-celeste/60 font-medium text-texto" : "border-transparent text-texto hover:bg-marca-suave"}`}
            >
              {p.texto}
            </Link>
          );
        })}
      </nav>
      {!sinFiltros && (
        <div className="flex flex-wrap items-end gap-3 border-b border-linea px-4 py-3 lg:px-8">
          <label><span className="etiqueta">Mes</span>
            <select className="campo w-44" value={filtro.mes} onChange={(e) => setFiltro({ mes: e.target.value })}>
              <option value="Todos">Todos los meses</option>
              {meses.map((m) => <option key={m} value={m}>{etiquetaMes(m)}</option>)}
            </select>
          </label>
          <div>
            <span className="etiqueta">Marca</span>
            <div className="flex h-9 overflow-hidden rounded-sm border border-linea bg-white text-sm" role="group">
              {(["Todas", "San Agustín", "Rocoto"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setFiltro({ marca: m })} aria-pressed={filtro.marca === m}
                  className={`px-3 ${filtro.marca === m ? "bg-marca font-medium text-white" : "text-texto-2 hover:bg-fondo"} ${m !== "Todas" ? "border-l border-linea" : ""}`}>
                  {m === "Todas" ? "Todas las marcas" : m}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Colores de marca del CP (par validado de la paleta categórica) */
export const COLOR_MARCA: Record<string, string> = { "San Agustín": "#1976d2", Rocoto: "#eb6834" };
export function EtiquetaMarca({ marca }: { marca: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_MARCA[marca] ?? "#999" }} aria-hidden />
      {marca}
    </span>
  );
}
