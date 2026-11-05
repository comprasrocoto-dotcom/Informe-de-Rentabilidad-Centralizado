"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const P = [
  { href: "/compras", texto: "General" },
  { href: "/compras/cocina-bar", texto: "Cocina y Bar" },
];

/** Pestañas del módulo de Compras, al estilo del ERP */
export function PestanasCompras() {
  const ruta = usePathname();
  return (
    <nav className="-mx-4 mb-4 flex border-b-2 border-celeste px-4 lg:-mx-8 lg:px-8" aria-label="Informes de compras">
      {P.map((p) => {
        const on = ruta === p.href;
        return (
          <Link key={p.href} href={p.href} aria-current={on ? "page" : undefined}
            className={`border-t-2 px-5 py-2.5 text-sm whitespace-nowrap ${on ? "border-marca bg-celeste/60 font-medium" : "border-transparent hover:bg-marca-suave"}`}>
            {p.texto}
          </Link>
        );
      })}
    </nav>
  );
}
