"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "./Contexto";

const ENLACES = [
  { href: "/", texto: "Resumen", icono: "M3 13h4v8H3zM10 8h4v13h-4zM17 3h4v18h-4z" },
  { href: "/ventas", texto: "Ventas", icono: "M3 17l6-6 4 4 8-8M15 7h6v6" },
  { href: "/descuentos", texto: "Descuentos", icono: "M19 5L5 19M7.5 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm9 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" },
  { href: "/compras", texto: "Compras", icono: "M3 4h2l2.4 11.2a1 1 0 001 .8h9.2a1 1 0 001-.8L20 8H6.2M9 20a1 1 0 100-2 1 1 0 000 2zm9 0a1 1 0 100-2 1 1 0 000 2z" },
  { href: "/costo", texto: "Costo", icono: "M12 3v18M17 7.5c0-1.9-2.2-3.5-5-3.5s-5 1.6-5 3.5 2.2 3 5 3.5 5 1.6 5 3.5-2.2 3.5-5 3.5-5-1.6-5-3.5" },
  { href: "/carta", texto: "Rentabilidad de carta", icono: "M5 4h14v16H5zM9 8h6M9 12h6M9 16h3" },
  { href: "/participacion", texto: "Participación", icono: "M12 3a9 9 0 109 9h-9z M14 3.3A9 9 0 0120.7 10H14z" },
  { href: "/inventarios", texto: "Inventarios", icono: "M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7M12 11v10" },
  { href: "/mercancia", texto: "Mercancía vendida", icono: "M4 6h16M4 12h16M4 18h10M18 16l2 2 3-3" },
  { href: "/cargar", texto: "Cargar datos", icono: "M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" },
];
const ADMIN = { href: "/admin", texto: "Administración", icono: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" };

function Icono({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function Menu() {
  const { perfil, marcas, sb } = useApp();
  const ruta = usePathname();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const misMarcas = perfil.rol === "admin" ? marcas : marcas.filter((m) => perfil.marcas.includes(m.id));
  const enlaces = perfil.rol === "admin" ? [...ENLACES, ADMIN] : ENLACES;

  async function salir() {
    await sb.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const contenido = (
    <>
      <div className="px-5 pt-6 pb-5">
        <div className="text-[15px] font-semibold tracking-tight text-white">Informe de Rentabilidad</div>
        <div className="mt-0.5 text-xs text-white/55">{perfil.rol === "admin" ? "Administrador" : "Acceso por marca"}</div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {enlaces.map((e) => {
          const activo = e.href === "/" ? ruta === "/" : ruta.startsWith(e.href);
          return (
            <Link
              key={e.href}
              href={e.href}
              onClick={() => setAbierto(false)}
              aria-current={activo ? "page" : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                activo ? "bg-white/12 font-medium text-white" : "text-white/70 hover:bg-white/6 hover:text-white"
              }`}
            >
              <Icono d={e.icono} />
              {e.texto}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-5 py-4">
        <div className="mb-2 text-xs text-white/55">{perfil.rol === "admin" ? "Todas las marcas" : misMarcas.length > 1 ? "Tus marcas" : "Tu marca"}</div>
        <ul className="mb-4 space-y-1">
          {misMarcas.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-[13px] text-white/85">
              <span className="h-1.5 w-1.5 rounded-full bg-[#5fbf9f]" aria-hidden />
              {m.nombre}
            </li>
          ))}
        </ul>
        <div className="truncate text-xs text-white/55" title={perfil.email}>{perfil.email}</div>
        <button onClick={salir} className="mt-2 text-xs font-medium text-white/80 underline-offset-2 hover:text-white hover:underline">
          Cerrar sesión
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Barra superior en pantallas pequeñas */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-tinta px-4 py-3 lg:hidden">
        <span className="text-sm font-semibold text-white">Informe de Rentabilidad</span>
        <button onClick={() => setAbierto((v) => !v)} className="rounded-md px-2 py-1 text-sm text-white/85 hover:bg-white/10" aria-expanded={abierto}>
          {abierto ? "Cerrar" : "Menú"}
        </button>
      </div>
      {abierto && <aside className="fixed inset-0 top-[52px] z-30 flex flex-col overflow-y-auto bg-tinta lg:hidden">{contenido}</aside>}
      {/* Menú lateral fijo en escritorio */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col overflow-y-auto bg-tinta lg:flex">{contenido}</aside>
    </>
  );
}
