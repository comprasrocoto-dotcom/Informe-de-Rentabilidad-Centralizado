"use client";

import Link from "next/link";
import { PESTANAS_CP } from "@/components/cp/NavCP";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApp } from "./Contexto";
import { Logo } from "./Logo";
import { Descargar } from "./Descargar";

// Menú en riel de íconos (como el ERP): ocupa 56 px y muestra el nombre al pasar el mouse.
export const ENLACES = [
  { href: "/", texto: "Resumen", icono: "M3 13h4v8H3zM10 8h4v13h-4zM17 3h4v18h-4z" },
  { href: "/ventas", texto: "Ventas", icono: "M3 17l6-6 4 4 8-8M15 7h6v6" },
  { href: "/descuentos", texto: "Descuentos", icono: "M19 5L5 19M7.5 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm9 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" },
  { href: "/compras", texto: "Compras", icono: "M3 4h2l2.4 11.2a1 1 0 001 .8h9.2a1 1 0 001-.8L20 8H6.2M9 20a1 1 0 100-2 1 1 0 000 2zm9 0a1 1 0 100-2 1 1 0 000 2z" },
  { href: "/traslados", texto: "Traslados", icono: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4z" },
  { href: "/costo", texto: "Costo", icono: "M12 3v18M17 7.5c0-1.9-2.2-3.5-5-3.5s-5 1.6-5 3.5 2.2 3 5 3.5 5 1.6 5 3.5-2.2 3.5-5 3.5-5-1.6-5-3.5" },
  { href: "/carta", texto: "Rentabilidad de carta", icono: "M5 4h14v16H5zM9 8h6M9 12h6M9 16h3" },
  { href: "/participacion", texto: "Participación", icono: "M12 3a9 9 0 109 9h-9zM14 3.3A9 9 0 0120.7 10H14z" },
  { href: "/inventarios", texto: "Inventarios", icono: "M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7M12 11v10" },
  { href: "/mercancia", texto: "Mercancía vendida", icono: "M4 6h16M4 12h16M4 18h10M18 16l2 2 3-3" },
  { href: "/cargar", texto: "Cargar datos", icono: "M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" },
];
export const CP = { href: "/cp", texto: "Centro de producción", icono: "M3 21V10l5 3V10l5 3V6l8 4v11zM3 21h18M8 17h2M13 17h2M18 17h0" };
export const ADMIN = { href: "/admin", texto: "Administración", icono: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" };

function Icono({ d, className = "h-[22px] w-[22px]" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function Menu() {
  const { perfil, marcas, sb, filtros } = useApp();
  const ruta = usePathname();
  const router = useRouter();
  const [cuenta, setCuenta] = useState(false);
  const refCuenta = useRef<HTMLDivElement>(null);
  const misMarcas = perfil.rol === "admin" ? marcas : marcas.filter((m) => perfil.marcas.includes(m.id));
  const enlaces = [...ENLACES, ...(perfil.verCP ? [CP] : []), ...(perfil.rol === "admin" ? [ADMIN] : [])];
  const activo = (href: string) => (href === "/" ? ruta === "/" : ruta === href || ruta.startsWith(href + "/"));
  const actual = enlaces.find((e) => activo(e.href));
  const enCP = ruta === "/cp" || ruta.startsWith("/cp/");
  const pestanaCP = enCP ? PESTANAS_CP.find((p) => p.href === ruta) : undefined;
  const marcaFiltro = marcas.find((m) => m.id === filtros.marcaId)?.nombre;

  useEffect(() => {
    if (!cuenta) return;
    const cerrar = (e: MouseEvent) => { if (!refCuenta.current?.contains(e.target as Node)) setCuenta(false); };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [cuenta]);

  async function salir() {
    await sb.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      {/* Riel de íconos */}
      <aside className="no-imprimir fixed inset-y-0 left-0 z-40 flex w-14 flex-col items-center bg-negro py-2">
        <Link href="/" className="mb-3 flex h-10 w-10 items-center justify-center" title="Informe de Rentabilidad">
          <Logo size={36} />
        </Link>
        <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto overflow-x-visible" aria-label="Menú principal">
          {enlaces.map((e) => {
            const on = activo(e.href);
            return (
              <Link
                key={e.href}
                href={e.href}
                aria-label={e.texto}
                aria-current={on ? "page" : undefined}
                className={`group relative flex h-10 w-10 items-center justify-center rounded-sm transition-colors ${on ? "bg-marca text-white" : "text-white/85 hover:bg-carbon hover:text-white"}`}
              >
                <Icono d={e.icono} />
                <span className="pointer-events-none fixed left-[60px] z-50 hidden rounded-sm bg-carbon px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white shadow-lg group-hover:block group-focus-visible:block">
                  {e.texto}
                </span>
              </Link>
            );
          })}
        </nav>
        <div ref={refCuenta} className="relative mt-2">
          <button
            onClick={() => setCuenta((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-marca text-sm font-semibold text-white ring-2 ring-white/20 hover:ring-white/50"
            aria-label="Mi cuenta" aria-expanded={cuenta}
          >
            {perfil.email.slice(0, 1).toUpperCase()}
          </button>
          {cuenta && (
            <div className="absolute bottom-0 left-12 z-50 w-64 rounded-sm border border-linea bg-white p-3 text-sm shadow-xl">
              <div className="truncate font-medium text-texto" title={perfil.email}>{perfil.email}</div>
              <div className="text-xs text-texto-2">{perfil.rol === "admin" ? "Administrador · todas las marcas" : misMarcas.length > 1 ? "Acceso a varias marcas" : "Acceso por marca"}</div>
              {perfil.rol !== "admin" && (
                <ul className="mt-2 space-y-0.5 text-[13px] text-texto">
                  {misMarcas.map((m) => <li key={m.id}>· {m.nombre}</li>)}
                </ul>
              )}
              <button onClick={salir} className="boton-sec mt-3 !h-8 w-full">Cerrar sesión</button>
            </div>
          )}
        </div>
      </aside>

      {/* Barra superior */}
      <header className="no-imprimir fixed top-0 right-0 left-14 z-30 flex h-9 items-stretch bg-carbon text-[14px] text-white">
        {enCP ? (
          <>
            <Link href="/cp" className="flex items-center px-6 font-medium text-white hover:bg-white/10">Centro de producción · Cierre de mes</Link>
            {pestanaCP && <div data-seccion className="flex items-center bg-marca px-6 font-medium text-white">{pestanaCP.texto}</div>}
            <div className="ml-auto hidden items-center gap-3 px-4 text-xs text-white/70 sm:flex">
              <span>San Agustín · Rocoto</span>
              <Link href="/" className="rounded-sm border border-white/30 px-2 py-0.5 text-white/90 hover:bg-white/10">← Informe de Rentabilidad</Link>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center px-6 text-white/90">Informe de Rentabilidad</div>
            {actual && <div data-seccion className="flex items-center bg-marca px-6 font-medium text-white">{actual.texto}</div>}
            <div className="ml-auto hidden items-center px-4 text-xs text-white/70 sm:flex">
              {perfil.rol === "admin" ? (marcaFiltro ?? "Todas las marcas") : misMarcas.map((m) => m.nombre).join(" · ")}
            </div>
          </>
        )}
        <Descargar />
      </header>
    </>
  );
}
