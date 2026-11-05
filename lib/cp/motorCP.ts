// Motor de cálculo del cierre de mes CP: misma lógica del tablero cierre-de-mes-cp.
import type { MarcaCP } from "./importadorCP";

export type Compra = { marca: MarcaCP; fecha: string; mes: string; almacen: string | null; serie: string | null; proveedor: string | null; familia: string | null; centro_costos: string | null; articulo: string | null; subarticulo: string | null; unidades: number; valor_unitario: number; total: number };
export type Fab = { marca: MarcaCP; fecha: string; mes: string; serie: string | null; codigo: string | null; artifabri: string | null; unidad: string | null; cantidad: number; costo: number };
export type Tras = { marca: MarcaCP; fecha: string; mes: string; serie: string | null; sede_destino: string | null; articulo: string | null; unidad: string | null; cantidad: number; costo: number };
export type Inv = { marca: MarcaCP; fecha: string; mes: string; articulo: string | null; categoria: string | null; unidad: string | null; stock_inventario: number; total: number };
export type Conv = { codigo: string | null; articulo: string | null; unidad: string | null; factor: number };
export type Costo = { mes: string; concepto: string; valor: number };
export type Manual = { mes: string; pct_san_agustin: number; actualizado: string };

export type DatosCP = { compras: Compra[]; fab: Fab[]; tras: Tras[]; inv: Inv[]; conv: Conv[]; costos: Costo[]; manual: Manual[] };
export const MARCAS_CP: MarcaCP[] = ["San Agustín", "Rocoto"];

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
export const normArt = (s: unknown) => String(s ?? "").trim().toUpperCase();
export const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + (f(r) || 0), 0);

export function mesAnterior(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const etiquetaMes = (k: string) => (k ? `${MESES[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}` : "—");

export type Filtro = { mes: string; marca: MarcaCP | "Todas" };
export const aplicar = <T extends { mes: string; marca?: MarcaCP }>(rows: T[], f: Filtro) =>
  rows.filter((r) => (f.mes === "Todos" || r.mes === f.mes) && (f.marca === "Todas" || !r.marca || r.marca === f.marca));

// ---------- Conversión a kilos (Fabricación × Base_Conversion) ----------
// Gramos con factor F → kg = cantidad / F ·  Und con factor F (gramos por unidad) → kg = cantidad × F / 1000
type Factor = { tipo: "gramos" | "und"; factor: number };
function factorDe(c: Conv): Factor | null {
  const u = norm(c.unidad);
  if (u === "gramos") return { tipo: "gramos", factor: c.factor };
  if (u === "und" || u === "unidad" || u === "unidades") return { tipo: "und", factor: c.factor };
  return null;
}
export function crearConversor(conv: Conv[]) {
  const porCodigo = new Map<string, Conv[]>();
  conv.forEach((c) => { if (c.codigo) (porCodigo.get(c.codigo) ?? porCodigo.set(c.codigo, []).get(c.codigo)!).push(c); });
  const sinCodigo = new Map<string, Conv>();
  conv.forEach((c) => { if (!c.codigo && c.articulo) sinCodigo.set(normArt(c.articulo), c); });
  const factor = (codigo: string | null, articulo: string | null): Factor | null => {
    if (codigo) {
      const cands = porCodigo.get(codigo);
      if (cands?.length) {
        // código repetido para dos productos: se desambigua por nombre
        if (cands.length > 1 && articulo) {
          const c = cands.find((x) => normArt(x.articulo) === normArt(articulo));
          if (c) return factorDe(c);
        }
        return factorDe(cands[0]);
      }
    }
    if (!articulo) return null;
    const c = sinCodigo.get(normArt(articulo));
    return c ? factorDe(c) : null;
  };
  const aKg = (codigo: string | null, articulo: string | null, qty: number | null) => {
    if (qty === null || qty === undefined) return null;
    const f = factor(codigo, articulo);
    if (!f) return null;
    return f.tipo === "gramos" ? qty / f.factor : (qty * f.factor) / 1000;
  };
  return { factor, aKg };
}

export type Participacion = {
  kgSA: number; kgRO: number; totalKg: number; pctSA: number | null; pctRO: number | null;
  sinConvN: number; sinConvCosto: number; totalFilas: number; marcaSinDatos: MarcaCP | null;
};
export function participacionKilos(rows: Fab[], aKg: ReturnType<typeof crearConversor>["aKg"]): Participacion {
  let kgSA = 0, kgRO = 0, sinConvN = 0, sinConvCosto = 0;
  rows.forEach((r) => {
    const kg = aKg(r.codigo, r.artifabri, r.cantidad);
    if (kg === null) { sinConvN++; sinConvCosto += r.costo; return; }
    if (r.marca === "San Agustín") kgSA += kg; else kgRO += kg;
  });
  const totalKg = kgSA + kgRO;
  const filasSA = rows.filter((r) => r.marca === "San Agustín").length;
  const filasRO = rows.filter((r) => r.marca === "Rocoto").length;
  return {
    kgSA, kgRO, totalKg,
    pctSA: totalKg ? Math.round((kgSA / totalKg) * 10000) / 100 : null,
    pctRO: totalKg ? Math.round((kgRO / totalKg) * 10000) / 100 : null,
    sinConvN, sinConvCosto, totalFilas: rows.length,
    marcaSinDatos: filasSA === 0 ? "San Agustín" : filasRO === 0 ? "Rocoto" : null,
  };
}

/** % efectivo del mes: el manual si existe; si no, el automático por kilos (si ambas marcas fabricaron). */
export function pctEfectivo(d: DatosCP, mes: string, aKg: ReturnType<typeof crearConversor>["aKg"]) {
  const manual = d.manual.find((m) => m.mes === mes);
  const kg = participacionKilos(d.fab.filter((r) => r.mes === mes), aKg);
  if (manual) return { sa: Number(manual.pct_san_agustin), ro: Math.round((100 - Number(manual.pct_san_agustin)) * 100) / 100, origen: "manual" as const, kg, manual };
  if (!kg.marcaSinDatos && kg.pctSA !== null) return { sa: kg.pctSA, ro: kg.pctRO!, origen: "kilos" as const, kg, manual: null };
  return { sa: null, ro: null, origen: null, kg, manual: null };
}

// ---------- Kardex por mes y marca (valores) ----------
// Inicial = Inv Final del mes anterior (misma marca). Final esperado = Inicial + Compras − Traslados.
// Fabricación se muestra aparte como referencia. Diferencia = Final real − Final esperado.
export function kardexMesMarca(d: DatosCP, f: Filtro) {
  const combos = new Set(d.inv.map((r) => `${r.mes}|${r.marca}`));
  return [...combos].map((k) => {
    const [mes, marca] = k.split("|") as [string, MarcaCP];
    const finalTotal = sum(d.inv.filter((r) => r.mes === mes && r.marca === marca), (r) => r.total);
    const ant = mesAnterior(mes);
    const tieneAnt = d.inv.some((r) => r.mes === ant && r.marca === marca);
    const inicial = tieneAnt ? sum(d.inv.filter((r) => r.mes === ant && r.marca === marca), (r) => r.total) : null;
    const compras = sum(d.compras.filter((r) => r.mes === mes && r.marca === marca), (r) => r.total);
    const fab = sum(d.fab.filter((r) => r.mes === mes && r.marca === marca), (r) => r.costo);
    const tras = sum(d.tras.filter((r) => r.mes === mes && r.marca === marca), (r) => r.costo);
    const esperado = inicial !== null ? inicial + compras - tras : null;
    return { mes, marca, inicial, finalTotal, compras, fab, tras, esperado, diferencia: esperado !== null ? finalTotal - esperado : null };
  }).filter((k) => (f.mes === "Todos" || k.mes === f.mes) && (f.marca === "Todas" || k.marca === f.marca))
    .sort((a, b) => a.mes.localeCompare(b.mes) || a.marca.localeCompare(b.marca));
}

// ---------- Kardex por producto (sub-recetas) ----------
// Inicial (Inv Final mes anterior) + Fabricado − Trasladado = Final esperado, contra el Final real.
// Semáforo por desviación absoluta: ≤5 % bien · ≤20 % manejable · >20 % muy elevado.
export type Estado = "bien" | "manejable" | "muy elevado";
export type FilaKardex = {
  articulo: string; unidad: string; codigo: string | null; convertible: boolean;
  inicial: number | null; fabricado: number; trasladado: number; finalReal: number | null; esperado: number | null; variacion: number | null; estado: Estado | null;
  kg: { inicial: number | null; fabricado: number | null; trasladado: number | null; esperado: number | null; finalReal: number | null; variacion: number | null };
};
export function kardexProductos(d: DatosCP, mes: string, marca: MarcaCP, conv: ReturnType<typeof crearConversor>): FilaKardex[] {
  const ant = mesAnterior(mes);
  const codigoDe = new Map<string, string>();
  d.fab.forEach((r) => { const k = normArt(r.artifabri); if (r.codigo && !codigoDe.has(k)) codigoDe.set(k, r.codigo); });
  const acumular = <R,>(rows: R[], key: (r: R) => string, qty: (r: R) => number, unidad: (r: R) => string | null) => {
    const m = new Map<string, { qty: number; unidad: string | null }>();
    rows.forEach((r) => { const k = key(r); const o = m.get(k) ?? { qty: 0, unidad: unidad(r) }; o.qty += qty(r); m.set(k, o); });
    return m;
  };
  const invPrev = acumular(d.inv.filter((r) => r.mes === ant && r.marca === marca), (r) => normArt(r.articulo), (r) => r.stock_inventario, (r) => r.unidad);
  const invCur = acumular(d.inv.filter((r) => r.mes === mes && r.marca === marca), (r) => normArt(r.articulo), (r) => r.stock_inventario, (r) => r.unidad);
  const fab = acumular(d.fab.filter((r) => r.mes === mes && r.marca === marca), (r) => normArt(r.artifabri), (r) => r.cantidad, (r) => r.unidad);
  const tras = acumular(d.tras.filter((r) => r.mes === mes && r.marca === marca), (r) => normArt(r.articulo), (r) => r.cantidad, (r) => r.unidad);
  const claves = new Set([...invPrev.keys(), ...invCur.keys(), ...fab.keys(), ...tras.keys()]);
  const filas = [...claves].map((k) => {
    const unidad = invCur.get(k)?.unidad || invPrev.get(k)?.unidad || fab.get(k)?.unidad || tras.get(k)?.unidad || "";
    const codigo = codigoDe.get(k) ?? null;
    const inicial = invPrev.has(k) ? invPrev.get(k)!.qty : null;
    const fabricado = fab.get(k)?.qty ?? 0;
    const trasladado = tras.get(k)?.qty ?? 0;
    const finalReal = invCur.has(k) ? invCur.get(k)!.qty : null;
    const esperado = inicial !== null ? inicial + fabricado - trasladado : null;
    const variacion = esperado !== null && finalReal !== null ? finalReal - esperado : null;
    let estado: Estado | null = null;
    if (variacion !== null) {
      const desv = Math.abs(variacion) / Math.max(Math.abs(esperado!), 1);
      estado = desv <= 0.05 ? "bien" : desv <= 0.2 ? "manejable" : "muy elevado";
    }
    const kg = (q: number | null) => conv.aKg(codigo, k, q);
    return {
      articulo: k, unidad, codigo, convertible: !!conv.factor(codigo, k),
      inicial, fabricado, trasladado, finalReal, esperado, variacion, estado,
      kg: { inicial: kg(inicial), fabricado: kg(fabricado), trasladado: kg(trasladado), esperado: kg(esperado), finalReal: kg(finalReal), variacion: kg(variacion) },
    };
  });
  return filas.sort((a, b) => Math.abs(b.variacion ?? 0) - Math.abs(a.variacion ?? 0));
}
