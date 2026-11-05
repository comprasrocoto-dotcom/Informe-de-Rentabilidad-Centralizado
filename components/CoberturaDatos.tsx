"use client";

// "¿Qué falta por subir?": por marca, tipo y sede, mes a mes, si hay datos cargados.
//  · Ventas, compras y traslados: días del mes con datos (completo ≥ 90 % de los días, parcial, o falta).
//  · Inventarios: hay conteo de cierre (último conteo del día 25 en adelante), solo conteo a mitad de mes, o falta.
//  · Rentabilidad de carta: cargada o no, por marca.
import { useEffect, useMemo, useState } from "react";
import { useApp } from "./Contexto";

type Celda = { t: string; m: number; s: number; mes: string; d: number; f: number; u: string };
type Carta = { m: number; n: number; c: string | null };
export type TipoCob = "ventas" | "compras" | "inventarios" | "traslados" | "rentabilidad";
const TIPOS: { v: Exclude<TipoCob, "rentabilidad">; t: string }[] = [
  { v: "ventas", t: "Ventas" }, { v: "compras", t: "Compras" }, { v: "inventarios", t: "Inventarios" }, { v: "traslados", t: "Traslados" },
];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const etq = (k: string) => `${MESES[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`;
const diasDelMes = (k: string) => new Date(Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)), 0)).getUTCDate();
const hoyBogota = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
function rango(desde: string, hasta: string) {
  const out: string[] = [];
  let [y, m] = desde.split("-").map(Number);
  for (let i = 0; i < 60; i++) { const k = `${y}-${String(m).padStart(2, "0")}`; out.push(k); if (k >= hasta) break; m++; if (m > 12) { m = 1; y++; } }
  return out;
}
type Estado = "ok" | "parcial" | "falta" | "curso";
const ESTILO: Record<Estado, string> = {
  ok: "bg-[#e8f5e9] text-bien", parcial: "bg-[#fff8e1] text-[#8d6e00]", falta: "bg-[#ffebee] text-alerta font-semibold", curso: "bg-fondo text-texto-3",
};

export function CoberturaDatos({ marcaFiltro, tipoFiltro }: { marcaFiltro: number | null; tipoFiltro: TipoCob | null }) {
  const { sb, marcas, sedes, perfil } = useApp();
  const [datos, setDatos] = useState<{ meses: Celda[]; carta: Carta[] } | null>(null);
  const [desde, setDesde] = useState("");
  const [soloFaltantes, setSoloFaltantes] = useState(false);
  useEffect(() => {
    sb.rpc("cobertura_datos").then(({ data }) => setDatos((data as { meses: Celda[]; carta: Carta[] }) ?? { meses: [], carta: [] }));
  }, [sb]);

  const hoy = hoyBogota(), mesActual = hoy.slice(0, 7);
  const primerMes = useMemo(() => datos?.meses.reduce((a, c) => (c.mes < a ? c.mes : a), mesActual) ?? mesActual, [datos, mesActual]);
  const ini = desde || primerMes;
  const meses = rango(ini, mesActual);
  const misMarcas = (perfil.rol === "admin" ? marcas : marcas.filter((m) => perfil.marcas.includes(m.id))).filter((m) => marcaFiltro == null || m.id === marcaFiltro);
  const tipos = TIPOS.filter((t) => tipoFiltro == null || t.v === tipoFiltro);

  const indice = useMemo(() => {
    const m = new Map<string, Celda>();
    datos?.meses.forEach((c) => m.set(`${c.t}|${c.s}|${c.mes}`, c));
    return m;
  }, [datos]);

  function estado(tipo: string, sedeId: number, mes: string): { e: Estado; texto: string; titulo: string } {
    const c = indice.get(`${tipo}|${sedeId}|${mes}`);
    const enCurso = mes === mesActual;
    if (tipo === "inventarios") {
      if (!c) return enCurso ? { e: "curso", texto: "—", titulo: "Mes en curso" } : { e: "falta", texto: "Falta", titulo: "No hay ningún conteo de inventario en el mes" };
      const dia = Number(c.u.slice(8, 10));
      return dia >= 25 || enCurso
        ? { e: "ok", texto: `✓ ${dia}`, titulo: `${c.d} conteo(s); último el día ${dia}` }
        : { e: "parcial", texto: `día ${dia}`, titulo: `${c.d} conteo(s), el último el día ${dia}: falta el conteo de cierre de mes` };
    }
    const esperados = enCurso ? Math.max(1, Number(hoy.slice(8, 10)) - 1) : diasDelMes(mes);
    if (!c) return enCurso ? { e: "curso", texto: "—", titulo: "Mes en curso, aún sin datos" } : { e: "falta", texto: "Falta", titulo: "No hay datos de este mes" };
    const e: Estado = c.d >= esperados * 0.9 ? "ok" : enCurso ? "curso" : "parcial";
    return { e, texto: e === "ok" ? `✓ ${c.d}` : `${c.d}/${esperados} d`, titulo: `${c.d} días con datos de ${esperados} · ${c.f.toLocaleString("es-CO")} filas · último día ${c.u}` };
  }

  // Filas: marca → tipo → sede. Las sedes de producción solo aparecen si alguna vez tuvieron datos de ese tipo
  const filas = misMarcas.flatMap((m) => tipos.flatMap((t) => sedes
    .filter((s) => s.marca_id === m.id)
    .filter((s) => s.tipo === "punto_venta" ? true : t.v !== "ventas" && datos?.meses.some((c) => c.t === t.v && c.s === s.id))
    .map((s) => {
      const celdas = meses.map((mes) => ({ mes, ...estado(t.v, s.id, mes) }));
      return { marca: m.nombre, tipo: t.t, sede: s.nombre, celdas, faltan: celdas.filter((c) => c.e === "falta").length, parciales: celdas.filter((c) => c.e === "parcial").length };
    })));
  const visibles = soloFaltantes ? filas.filter((f) => f.faltan || f.parciales) : filas;
  const totalFaltan = filas.reduce((a, f) => a + f.faltan, 0), totalParciales = filas.reduce((a, f) => a + f.parciales, 0);
  const verCarta = tipoFiltro == null || tipoFiltro === "rentabilidad";
  const cartas = misMarcas.map((m) => ({ marca: m.nombre, c: datos?.carta.find((x) => x.m === m.id) }));

  return (
    <div className="tarjeta overflow-hidden !p-0">
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-3 pb-2">
        <div>
          <h2 className="text-sm font-medium">¿Qué falta por subir?</h2>
          <p className="text-xs text-texto-2">Mes a mes, por marca, tipo y sede. Pasa el mouse sobre una casilla para ver el detalle. El mes en curso sale en gris.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-texto-2">Desde
            <select className="campo ml-2 !py-1" value={ini} onChange={(e) => setDesde(e.target.value)}>
              {rango("2025-01", mesActual).reverse().map((m) => <option key={m} value={m}>{etq(m)}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-texto-2"><input type="checkbox" checked={soloFaltantes} onChange={(e) => setSoloFaltantes(e.target.checked)} /> Solo lo que falta</label>
        </div>
      </div>
      {!datos ? <p className="px-4 pb-4 text-sm text-texto-2">Revisando la base…</p> : (
        <>
          <div className="flex flex-wrap gap-2 px-4 pb-3 text-xs">
            <span className={`rounded-full px-2.5 py-1 font-semibold ${ESTILO.falta}`}>{totalFaltan} meses faltan</span>
            <span className={`rounded-full px-2.5 py-1 font-semibold ${ESTILO.parcial}`}>{totalParciales} meses incompletos</span>
            <span className={`rounded-full px-2.5 py-1 ${ESTILO.ok}`}>✓ = completo (número = días con datos; en inventarios, día del último conteo)</span>
          </div>
          <div className="max-h-[60vh] overflow-auto">
            <table className="tabla text-xs">
              <thead className="sticky top-0 z-10">
                <tr><th>Marca</th><th>Tipo</th><th>Sede</th>{meses.map((m) => <th key={m} className="text-center">{etq(m)}</th>)}</tr>
              </thead>
              <tbody>
                {visibles.map((f, i) => (
                  <tr key={`${f.marca}${f.tipo}${f.sede}`} className={i > 0 && visibles[i - 1].tipo !== f.tipo ? "border-t-2 border-linea" : ""}>
                    <td className="font-medium whitespace-nowrap">{f.marca}</td><td className="whitespace-nowrap">{f.tipo}</td><td className="whitespace-nowrap">{f.sede}</td>
                    {f.celdas.map((c) => <td key={c.mes} className="p-0.5 text-center"><span title={c.titulo} className={`block rounded-sm px-1 py-0.5 whitespace-nowrap ${ESTILO[c.e]}`}>{c.texto}</span></td>)}
                  </tr>
                ))}
                {verCarta && cartas.map((c) => (!soloFaltantes || !c.c) && (
                  <tr key={`carta${c.marca}`} className="border-t-2 border-linea">
                    <td className="font-medium whitespace-nowrap">{c.marca}</td><td>Rentabilidad de carta</td><td className="text-texto-3">Toda la marca</td>
                    <td colSpan={meses.length} className="p-0.5">
                      <span className={`inline-block rounded-sm px-2 py-0.5 ${c.c ? ESTILO.ok : ESTILO.falta}`}>
                        {c.c ? `✓ Cargada · ${c.c.n.toLocaleString("es-CO")} artículos${c.c.c ? ` · subida el ${new Date(c.c.c).toLocaleDateString("es-CO")}` : ""}` : "Falta subir la carta (fichas de costo)"}
                      </span>
                    </td>
                  </tr>
                ))}
                {!visibles.length && !(verCarta && cartas.length) && <tr><td colSpan={meses.length + 3} className="text-texto-3">{soloFaltantes ? "No falta nada para este filtro. 🎉" : "Sin sedes para este filtro."}</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
