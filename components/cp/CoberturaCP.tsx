"use client";

// "¿Qué falta por subir?" del Centro de producción: por tipo y marca (San Agustín / Rocoto), mes a mes.
//  · Compras, fabricación y traslados: ✓ si hay datos hasta el día 25 o después; amarillo "hasta el día X" si el
//    último dato es anterior; rojo "Falta" si no hay nada.  · Inventario final: ✓ si hay conteo desde el día 25.
//  · Costos compartidos: ✓ si el mes tiene conceptos.  · Base de conversión: cargada o no (no va por mes).
import type { MarcaCP } from "@/lib/cp/importadorCP";

export type CobCP = {
  cargas: { c: number; m: MarcaCP; n: number }[];
  meses: { t: string; m: MarcaCP; mes: string; d: number; f: number; u: string }[];
  costos: { mes: string; n: number; v: number }[];
  base: number;
};
export type TipoFiltroCP = "compras" | "fabricaciones" | "traslados" | "inventarios" | "costos" | "base_conversion";
const TIPOS: { v: "compras" | "fabricaciones" | "traslados" | "inventarios"; t: string }[] = [
  { v: "compras", t: "Compras" }, { v: "fabricaciones", t: "Fabricación" }, { v: "traslados", t: "Traslados" }, { v: "inventarios", t: "Inventario final" },
];
const MARCAS: MarcaCP[] = ["San Agustín", "Rocoto"];
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const etq = (k: string) => `${MES[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`;
const ESTILO = {
  ok: "bg-[#e8f5e9] text-bien", parcial: "bg-[#fff8e1] text-[#8d6e00]", falta: "bg-[#ffebee] text-alerta font-semibold", curso: "bg-fondo text-texto-3",
};
function rango(desde: string, hasta: string) {
  const out: string[] = [];
  let [y, m] = desde.split("-").map(Number);
  for (let i = 0; i < 60; i++) { const k = `${y}-${String(m).padStart(2, "0")}`; out.push(k); if (k >= hasta) break; m++; if (m > 12) { m = 1; y++; } }
  return out;
}

export function CoberturaCP({ cob, marca, tipo }: { cob: CobCP | null; marca: MarcaCP | null; tipo: TipoFiltroCP | null }) {
  if (!cob) return <p className="p-4 text-sm text-texto-2">Revisando la base…</p>;
  const mesActual = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }).slice(0, 7);
  const primero = [...cob.meses.map((x) => x.mes), ...cob.costos.map((x) => x.mes)].sort()[0] ?? mesActual;
  const meses = rango(primero, mesActual);
  const marcas = marca ? [marca] : MARCAS;
  const tipos = TIPOS.filter((t) => !tipo || t.v === tipo);

  const celda = (t: string, m: MarcaCP, mes: string) => {
    const c = cob.meses.find((x) => x.t === t && x.m === m && x.mes === mes);
    if (mes === mesActual) return c ? { e: "curso" as const, txt: `${c.f.toLocaleString("es-CO")} f`, tit: `Mes en curso · ${c.f} filas · último día ${c.u}` } : { e: "curso" as const, txt: "—", tit: "Mes en curso" };
    if (!c) return { e: "falta" as const, txt: "Falta", tit: "No hay datos de este mes" };
    const dia = Number(c.u.slice(8, 10));
    return dia >= 25
      ? { e: "ok" as const, txt: `✓ ${c.f.toLocaleString("es-CO")}`, tit: `${c.f} filas en ${c.d} días · último día ${c.u}` }
      : { e: "parcial" as const, txt: `hasta día ${dia}`, tit: `${c.f} filas · el último dato es del ${c.u}: puede faltar el final del mes` };
  };
  const filas = tipos.flatMap((t) => marcas.map((m) => ({ t, m, celdas: meses.map((mes) => ({ mes, ...celda(t.v, m, mes) })) })));
  const faltan = filas.reduce((a, f) => a + f.celdas.filter((c) => c.e === "falta").length, 0);
  const parciales = filas.reduce((a, f) => a + f.celdas.filter((c) => c.e === "parcial").length, 0);
  const verCostos = !tipo || tipo === "costos", verBase = !tipo || tipo === "base_conversion";

  return (
    <>
      <div className="flex flex-wrap gap-2 px-4 pt-3 pb-2 text-xs">
        <span className={`rounded-full px-2.5 py-1 font-semibold ${ESTILO.falta}`}>{faltan} meses faltan</span>
        <span className={`rounded-full px-2.5 py-1 font-semibold ${ESTILO.parcial}`}>{parciales} meses incompletos</span>
        <span className={`rounded-full px-2.5 py-1 ${ESTILO.ok}`}>✓ = datos hasta fin de mes (número = filas)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="tabla text-xs">
          <thead><tr><th>Tipo</th><th>Marca</th>{meses.map((m) => <th key={m} className="text-center">{etq(m)}</th>)}</tr></thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={f.t.v + f.m} className={i > 0 && filas[i - 1].t.v !== f.t.v ? "border-t-2 border-linea" : ""}>
                <td className="font-medium whitespace-nowrap">{f.t.t}</td><td className="whitespace-nowrap">{f.m}</td>
                {f.celdas.map((c) => <td key={c.mes} className="p-0.5 text-center"><span title={c.tit} className={`block rounded-sm px-1 py-0.5 whitespace-nowrap ${ESTILO[c.e]}`}>{c.txt}</span></td>)}
              </tr>
            ))}
            {verCostos && (
              <tr className="border-t-2 border-linea">
                <td className="font-medium">Costos compartidos</td><td className="text-texto-3">Ambas</td>
                {meses.map((mes) => {
                  const c = cob.costos.find((x) => x.mes === mes);
                  const e = c ? "ok" : mes === mesActual ? "curso" : "falta";
                  return <td key={mes} className="p-0.5 text-center"><span title={c ? `${c.n} conceptos · $${Math.round(c.v).toLocaleString("es-CO")}` : "Sin costos compartidos este mes"} className={`block rounded-sm px-1 py-0.5 whitespace-nowrap ${ESTILO[e]}`}>{c ? `✓ ${c.n}` : e === "curso" ? "—" : "Falta"}</span></td>;
                })}
              </tr>
            )}
            {verBase && (
              <tr className="border-t-2 border-linea">
                <td className="font-medium">Base de conversión</td><td className="text-texto-3">Ambas</td>
                <td colSpan={meses.length} className="p-0.5"><span className={`inline-block rounded-sm px-2 py-0.5 ${cob.base ? ESTILO.ok : ESTILO.falta}`}>{cob.base ? `✓ Cargada · ${cob.base} códigos (no va por mes)` : "Falta subir la base de conversión"}</span></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Chips con las filas de cada marca en una carga */
export function MarcasDeCarga({ cob, id }: { cob: CobCP | null; id: number }) {
  const de = (cob?.cargas ?? []).filter((x) => x.c === id);
  if (!de.length) return <span className="text-texto-3">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {de.sort((a, b) => a.m.localeCompare(b.m)).map((x) => (
        <span key={x.m} className={`rounded-sm px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-white ${x.m === "Rocoto" ? "bg-[#eb6834]" : "bg-marca"}`}>
          {x.m} · {x.n.toLocaleString("es-CO")}
        </span>
      ))}
    </span>
  );
}
