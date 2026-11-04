"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";

export type Perfil = { email: string; rol: "admin" | "marca"; marca_id: number | null };
export type Marca = { id: number; nombre: string };
export type Sede = { id: number; marca_id: number; nombre: string; tipo: "punto_venta" | "produccion" };

type Filtros = {
  marcaId: number | null; // null = todas (solo admin)
  sedeId: number | null; // null = todas las sedes
  desde: string;
  hasta: string;
};

type Ctx = {
  perfil: Perfil;
  marcas: Marca[];
  sedes: Sede[];
  filtros: Filtros;
  setFiltros: (f: Partial<Filtros>) => void;
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
    marcaId: perfil.rol === "admin" ? null : perfil.marca_id,
    sedeId: null,
    desde: primerDiaHaceMeses(12),
    hasta: new Date().toISOString().slice(0, 10),
  });

  async function recargarCatalogos() {
    const [m, s] = await Promise.all([
      sb.from("marcas").select("id,nombre").order("nombre"),
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
          marcaId: perfil.rol === "admin" && (typeof g.marcaId === "number" || g.marcaId === null) ? g.marcaId : f.marcaId,
        }));
      }
    } catch {
      /* sin almacenamiento disponible */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setFiltros(p: Partial<Filtros>) {
    setF((f) => {
      const n = { ...f, ...p };
      if (perfil.rol !== "admin") n.marcaId = perfil.marca_id;
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
    <Contexto.Provider value={{ perfil, marcas, sedes, filtros, setFiltros, recargarCatalogos, sb }}>
      {children}
    </Contexto.Provider>
  );
}
