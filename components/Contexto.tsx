"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";

// verCP: el Centro de producción lo ven el admin y quien tenga 123 WOK o ROCOTO (marcas que comparten el CP)
export type Perfil = { email: string; rol: "admin" | "marca"; marcas: number[]; verCP: boolean };
export type Marca = { id: number; nombre: string; meta_costo: number };
export type Sede = { id: number; marca_id: number; nombre: string; tipo: "punto_venta" | "produccion" };

type Filtros = {
  marcaId: number | null; // null = todas las marcas que el usuario puede ver
  sedeId: number | null; // null = todas las sedes
  desde: string;
  hasta: string;
  cc: "todos" | "Cocina" | "Bar"; // centro de costo
};

type Ctx = {
  perfil: Perfil;
  marcas: Marca[];
  sedes: Sede[];
  filtros: Filtros;
  setFiltros: (f: Partial<Filtros>) => void;
  /** true si el usuario puede elegir entre varias marcas (admin o con más de una) */
  variasMarcas: boolean;
  /** Meta de costo (fracción, ej. 0,35) de la marca filtrada; si son varias, la de la primera */
  meta: number;
  recargarCatalogos: () => Promise<void>;
  sb: ReturnType<typeof crearClienteNavegador>;
};

const Contexto = createContext<Ctx | null>(null);

export function useApp() {
  const c = useContext(Contexto);
  if (!c) throw new Error("useApp fuera del proveedor");
  return c;
}

function primerDiaHaceMeses(n: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

export function ProveedorApp({ perfil, children }: { perfil: Perfil; children: React.ReactNode }) {
  const sb = useMemo(() => crearClienteNavegador(), []);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [filtros, setF] = useState<Filtros>({
    marcaId: perfil.rol !== "admin" && perfil.marcas.length === 1 ? perfil.marcas[0] : null,
    sedeId: null,
    desde: primerDiaHaceMeses(12),
    hasta: new Date().toISOString().slice(0, 10),
    cc: "todos",
  });

  async function recargarCatalogos() {
    const [m, s] = await Promise.all([
      sb.from("marcas").select("id,nombre,meta_costo").order("nombre"),
      sb.from("sedes").select("id,marca_id,nombre,tipo").order("nombre"),
    ]);
    setMarcas((m.data as Marca[]) ?? []);
    setSedes((s.data as Sede[]) ?? []);
  }

  useEffect(() => {
    recargarCatalogos();
    try {
      const g = JSON.parse(localStorage.getItem("filtros-rentabilidad") || "null");
      if (g && typeof g === "object") {
        setF((f) => ({
          ...f,
          desde: typeof g.desde === "string" ? g.desde : f.desde,
          hasta: typeof g.hasta === "string" ? g.hasta : f.hasta,
          marcaId: marcaPermitida(g.marcaId) ? g.marcaId : f.marcaId,
        }));
      }
    } catch {
      /* sin almacenamiento disponible */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const variasMarcas = perfil.rol === "admin" || perfil.marcas.length > 1;
  const marcaMeta = marcas.find((m) => m.id === filtros.marcaId) ?? marcas.find((m) => perfil.rol === "admin" || perfil.marcas.includes(m.id));
  const meta = Number(marcaMeta?.meta_costo ?? 0.35);

  function marcaPermitida(m: unknown): m is number | null {
    if (m === null) return variasMarcas;
    if (typeof m !== "number") return false;
    return perfil.rol === "admin" || perfil.marcas.includes(m);
  }

  function setFiltros(p: Partial<Filtros>) {
    setF((f) => {
      const n = { ...f, ...p };
      if (!marcaPermitida(n.marcaId)) n.marcaId = f.marcaId;
      if (p.marcaId !== undefined && p.marcaId !== f.marcaId) n.sedeId = null;
      try {
        localStorage.setItem("filtros-rentabilidad", JSON.stringify({ desde: n.desde, hasta: n.hasta, marcaId: n.marcaId }));
      } catch {
        /* ignorar */
      }
      return n;
    });
  }

  return (
    <Contexto.Provider value={{ perfil, marcas, sedes, filtros, setFiltros, variasMarcas, meta, recargarCatalogos, sb }}>
      {children}
    </Contexto.Provider>
  );
}
