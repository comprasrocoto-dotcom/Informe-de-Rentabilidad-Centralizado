// Análisis de compras frente a ventas, mes a mes y por centro de costo.
//
//   Compras            = compras del centro de costo + traslados recibidos (todo lo que entró para vender).
//   % compra/venta     = Compras ÷ Ventas del mismo centro (Total = Cocina + Bar sobre ventas base).
//   % de referencia    = el del mes anterior, el promedio de los meses anteriores o la meta de costo.
//   Compra esperada    = Ventas del mes × % de referencia  ("con lo que vendí, cuánto debí comprar").
//   Diferencia         = Compras − Compra esperada. Positivo = compró de más; negativo = compró de menos.
//   Variación inv.     = Inv. final − Inv. inicial del mes (si hay los dos conteos): muestra si lo comprado
//                        de más quedó guardado en inventario o se consumió.
import { cifras, type Bloque, type FiltroCC } from "./rentabilidad";

export type Referencia = "anterior" | "promedio" | "meta";
export type Senal = "de más" | "de menos" | "en línea" | "sin referencia";

export type FilaCV = {
  mes: string; ventas: number; compras: number; traslados: number; pct: number | null;
  varVentas: number | null; varCompras: number | null;
  pctRef: number | null; deltaPts: number | null; esperada: number | null; diferencia: number | null;
  deltaInv: number | null; senal: Senal;
};

const div = (a: number, b: number) => (b ? a / b : null);
const varPct = (a: number, b: number | undefined) => (b ? (a - b) / Math.abs(b) : null);

/** `meses` debe venir ordenado. Solo se devuelven los meses >= desdeMes (los anteriores sirven de referencia). */
export function analizar(meses: [string, Bloque][], cc: FiltroCC, ref: Referencia, meta: number, umbral: number, desdeMes = "") {
  const base = meses.map(([mes, b]) => {
    const c = cifras(b, cc);
    const compras = c.compras + c.traslados;
    return { mes, ventas: c.ventasBase, compras, traslados: c.traslados, completo: c.completo && c.tieneIni && c.tieneFin, invIni: c.invIni, invFin: c.invFin };
  });
  const filas: FilaCV[] = base.map((x, i) => {
    const prev = base[i - 1];
    const pct = div(x.compras, x.ventas);
    let pctRef: number | null = null;
    if (ref === "meta") pctRef = meta;
    else if (ref === "anterior") pctRef = prev ? div(prev.compras, prev.ventas) : null;
    else {
      const ant = base.slice(0, i);
      pctRef = ant.length ? div(ant.reduce((a, r) => a + r.compras, 0), ant.reduce((a, r) => a + r.ventas, 0)) : null;
    }
    const esperada = pctRef !== null && x.ventas ? x.ventas * pctRef : null;
    const diferencia = esperada !== null ? x.compras - esperada : null;
    const deltaPts = pct !== null && pctRef !== null ? pct - pctRef : null;
    const senal: Senal = deltaPts === null ? "sin referencia" : deltaPts > umbral ? "de más" : deltaPts < -umbral ? "de menos" : "en línea";
    return {
      mes: x.mes, ventas: x.ventas, compras: x.compras, traslados: x.traslados, pct,
      varVentas: varPct(x.ventas, prev?.ventas), varCompras: varPct(x.compras, prev?.compras),
      pctRef, deltaPts, esperada, diferencia, deltaInv: x.completo ? x.invFin - x.invIni : null, senal,
    };
  });
  return filas.filter((f) => f.mes >= desdeMes);
}

/** Compra de más acumulada: suma la diferencia de los meses marcados "de más" (fuera de la tolerancia). */
export const excesoAcumulado = (filas: FilaCV[]) => filas.reduce((a, f) => a + (f.senal === "de más" ? Math.max(0, f.diferencia ?? 0) : 0), 0);
