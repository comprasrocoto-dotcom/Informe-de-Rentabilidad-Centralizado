"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "./Contexto";

const ENLACES = [
  { href: "/", texto: "Resumen" },
  { href: "/ventas", texto: "Ventas" },
  { href: "/compras", texto: "Compras" },
  { href: "/carta", texto: "Rentabilidad de carta" },
  { href: "/cargar", texto: "Cargar datos" },
];

export function Menu() {
  const { perfil, marcas, sb } = useApp();
  const ruta = usePathname();
  const router = useRouter();
  const marca = marcas.find((m) => m.id === perfil.marca_id);
  const enlaces = perfil.rol === "admin" ? [...ENLACES, { href: "/admin", texto: "Administración" }] : ENLACES;

  async function salir() {
    await sb.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <div className="mr-2">
          <div className="text-sm font-semibold">Informe de Rentabilidad</div>
          <div className="text-xs text-stone-500">
            {perfil.rol === "admin" ? "Administrador · todas las marcas" : marca?.nombre ?? "…"}
          </div>
        </div>
        <nav className="flex flex-1 flex-wrap gap-1 text-sm">
          {enlaces.map((e) => {
            const activo = e.href === "/" ? ruta === "/" : ruta.startsWith(e.href);
            return (
              <Link
                key={e.href}
                href={e.href}
                className={`rounded-md px-3 py-1.5 ${activo ? "bg-blue-50 font-medium text-blue-800" : "text-stone-600 hover:bg-stone-100"}`}
              >
                {e.texto}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 text-xs text-stone-500">
          <span className="hidden sm:inline">{perfil.email}</span>
          <button onClick={salir} className="boton-sec !px-2.5 !py-1 !text-xs">Salir</button>
        </div>
      </div>
    </header>
  );
}
