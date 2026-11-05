// Cálculo de rentabilidad con la misma lógica del tablero de Casa de Nadie.
//
//   Ventas totales    = venta base (sin IVA, sin propinas) de todos los centros de costo.
//   Ventas excluidas  = artículos de centros distintos a Cocina/Bar con neto positivo en el mes (ej. Parking).
//   Ventas base       = Ventas totales − Ventas excluidas  (descuentos y notas crédito siguen restando).
//   Mercancía vendida = Inv. inicial + Compras (+ Traslados) − Inv. final, solo Cocina y Bar.
//                       Si falta el conteo inicial o el final, solo Compras (+ Traslados).
//   Costo %           = Mercancía vendida / Ventas base.
//   Utilidad bruta    = Ventas totales − Mercancía vendida.
//   Por centro: Costo Cocina % = Mercancía vendida Cocina / Ventas Cocina (igual para Bar).
//
// Los centros de producción no suman a las sedes: su costo llega como traslados.

export type FilaCosto = {
  marca_id: number; sede_id: number; mes: string; grupo: "Cocina" | "Bar" | "Otros";
  ventas: number; ventas_excluidas: number; compras: number; traslados: number;
  inv_inicial: number; inv_final: number; tiene_ini: boolean; tiene_fin: boolean; ini_heredado: boolean;
  fecha_ini: string | null; fecha_fin: string | null; conteos: number;
};

export type Centro = {
  ventas: number; compras: number; traslados: number; invIni: number; invFin: number;
  tieneIni: boolean; tieneFin: boolean; heredado: boolean; fIni: string | null; fFin: string | null;
  completo: boolean; mv: number;
};

export type Bloque = {
  cocina: Centro; bar: Centro;
  ajustes: number; // descuentos / notas crédito de otros centros (restan)
  excluidas: number; // otros centros con venta positiva (ej. Parking)
  comprasOtros: number; // aseo, empaque, utensilios…
  meses: number;
};

const centroVacio = (): Centro => ({
  ventas: 0, compras: 0, traslados: 0, invIni: 0, invFin: 0, tieneIni: true, tieneFin: true,
  heredado: false, fIni: null, fFin: null, completo: true, mv: 0,
});
export const bloqueVacio = (): Bloque => ({ cocina: centroVacio(), bar: centroVacio(), ajustes: 0, excluidas: 0, comprasOtros: 0, meses: 0 });

/** Un mes de una sede (todas las filas de ese mes y sede). */
export function bloqueMes(filas: FilaCosto[]): Bloque {
  const b = bloqueVacio();
  b.meses = 1;
  const visto = { Cocina: false, Bar: false };
  for (const f of filas) {
    if (f.grupo === "Otros") {
      b.ajustes += Number(f.ventas);
      b.excluidas += Number(f.ventas_excluidas);
      b.comprasOtros += Number(f.compras) + Number(f.traslados);
      continue;
    }
    visto[f.grupo] = true;
    const c = f.grupo === "Cocina" ? b.cocina : b.bar;
    c.ventas = Number(f.ventas); c.compras = Number(f.compras); c.traslados = Number(f.traslados);
    c.invIni = Number(f.inv_inicial); c.invFin = Number(f.inv_final);
    c.tieneIni = f.tiene_ini; c.tieneFin = f.tiene_fin; c.heredado = f.ini_heredado;
    c.fIni = f.fecha_ini; c.fFin = f.fecha_fin;
  }
  for (const [g, c] of [["Cocina", b.cocina], ["Bar", b.bar]] as const) {
    if (!visto[g]) { c.tieneIni = false; c.tieneFin = false; }
    c.completo = c.tieneIni && c.tieneFin;
    c.mv = c.completo ? c.invIni + c.compras + c.traslados - c.invFin : c.compras + c.traslados;
  }
  return b;
}

function sumarCentro(a: Centro, b: Centro, primero: boolean, ultimo: boolean) {
  a.ventas += b.ventas; a.compras += b.compras; a.traslados += b.traslados; a.mv += b.mv;
  if (primero) { a.invIni += b.invIni; a.fIni = a.fIni ?? b.fIni; a.heredado = a.heredado || b.heredado; }
  if (ultimo) { a.invFin += b.invFin; a.fFin = b.fFin ?? a.fFin; }
  a.tieneIni = a.tieneIni && (b.tieneIni || b.ventas === 0);
  a.tieneFin = a.tieneFin && (b.tieneFin || b.ventas === 0);
  a.completo = a.completo && (b.completo || b.ventas === 0);
}

/**
 * Suma bloques. `primero`/`ultimo` indican si el bloque es el primer o último mes del período
 * (el inventario inicial del período es el del primer mes y el final el del último).
 */
export function sumarBloque(a: Bloque, b: Bloque, primero = true, ultimo = true) {
  sumarCentro(a.cocina, b.cocina, primero, ultimo);
  sumarCentro(a.bar, b.bar, primero, ultimo);
  a.ajustes += b.ajustes; a.excluidas += b.excluidas; a.comprasOtros += b.comprasOtros;
  a.meses += b.meses;
}

export const ventasBase = (b: Bloque) => b.cocina.ventas + b.bar.ventas + b.ajustes;
export const ventasTotales = (b: Bloque) => ventasBase(b) + b.excluidas;
export const mercancia = (b: Bloque) => b.cocina.mv + b.bar.mv;
export const compras = (b: Bloque) => b.cocina.compras + b.bar.compras;
export const traslados = (b: Bloque) => b.cocina.traslados + b.bar.traslados;
export const invIni = (b: Bloque) => b.cocina.invIni + b.bar.invIni;
export const invFin = (b: Bloque) => b.cocina.invFin + b.bar.invFin;
export const completo = (b: Bloque) => b.cocina.completo && b.bar.completo;
export const utilidad = (b: Bloque) => ventasTotales(b) - mercancia(b);

const d = (a: number, b: number) => (b ? a / b : null);
export const pctCosto = (b: Bloque) => d(mercancia(b), ventasBase(b));
export const pctCocina = (b: Bloque) => d(b.cocina.mv, b.cocina.ventas);
export const pctBar = (b: Bloque) => d(b.bar.mv, b.bar.ventas);

/** Texto corto de cómo se calculó la mercancía vendida. */
export function fuenteMV(b: Bloque): string {
  if (completo(b)) return b.cocina.heredado || b.bar.heredado ? "Inv. inicial (heredado) + Compras − Inv. final" : "Inv. inicial + Compras − Inv. final";
  return "Solo compras: falta un conteo de inventario";
}

/**
 * Agrupa las filas del motor por sede y mes, y arma totales por mes y del período.
 * Excluye los centros de producción de los totales (se devuelven aparte).
 */
export function agrupar(filas: FilaCosto[], esProduccion: (sedeId: number) => boolean, sedeFiltro: number | null) {
  const porClave = new Map<string, FilaCosto[]>();
  for (const f of filas) {
    if (sedeFiltro && f.sede_id !== sedeFiltro) continue;
    const k = `${f.mes}|${f.sede_id}`;
    (porClave.get(k) ?? porClave.set(k, []).get(k)!).push(f);
  }
  const meses = [...new Set([...porClave.keys()].map((k) => k.split("|")[0]))].sort();
  const porMesSede: { mes: string; sedeId: number; b: Bloque }[] = [];
  const produccion: { mes: string; sedeId: number; b: Bloque }[] = [];
  const porMes = new Map<string, Bloque>();
  const porSede = new Map<number, Bloque>();
  const total = bloqueVacio();
  const primerMesSede = new Map<number, string>();
  const ultimoMesSede = new Map<number, string>();
  for (const k of porClave.keys()) {
    const [mes, sid] = k.split("|");
    const s = Number(sid);
    if (!primerMesSede.has(s) || mes < primerMesSede.get(s)!) primerMesSede.set(s, mes);
    if (!ultimoMesSede.has(s) || mes > ultimoMesSede.get(s)!) ultimoMesSede.set(s, mes);
  }
  for (const [k, fs] of porClave) {
    const [mes, sid] = k.split("|");
    const sedeId = Number(sid);
    const b = bloqueMes(fs);
    if (esProduccion(sedeId) && !sedeFiltro) { produccion.push({ mes, sedeId, b }); continue; }
    porMesSede.push({ mes, sedeId, b });
    if (!porMes.has(mes)) porMes.set(mes, bloqueVacio());
    sumarBloque(porMes.get(mes)!, b);
    if (!porSede.has(sedeId)) porSede.set(sedeId, bloqueVacio());
    sumarBloque(porSede.get(sedeId)!, b, mes === primerMesSede.get(sedeId), mes === ultimoMesSede.get(sedeId));
    sumarBloque(total, b, mes === primerMesSede.get(sedeId), mes === ultimoMesSede.get(sedeId));
  }
  return {
    meses, total, porMesSede, produccion,
    porMes: [...porMes.entries()].sort(([a], [c]) => a.localeCompare(c)),
    porSede: [...porSede.entries()],
  };
}

export type FiltroCC = "todos" | "Cocina" | "Bar";

/** Cifras del bloque según el filtro de centro de costo (Todos / Cocina / Bar). */
export function cifras(b: Bloque, cc: FiltroCC) {
  if (cc === "todos") {
    const vb = ventasBase(b), mv = mercancia(b), vt = ventasTotales(b);
    return {
      ventasTot: vt, ventasBase: vb, excluidas: b.excluidas, ajustes: b.ajustes,
      compras: compras(b), traslados: traslados(b), invIni: invIni(b), invFin: invFin(b),
      mv, pct: d(mv, vb), utilidad: vt - mv, pctUtil: d(vt - mv, vt),
      completo: completo(b), heredado: b.cocina.heredado || b.bar.heredado,
      fIni: b.cocina.fIni ?? b.bar.fIni, fFin: b.cocina.fFin ?? b.bar.fFin,
      tieneIni: b.cocina.tieneIni && b.bar.tieneIni, tieneFin: b.cocina.tieneFin && b.bar.tieneFin,
    };
  }
  const c = cc === "Cocina" ? b.cocina : b.bar;
  return {
    ventasTot: c.ventas, ventasBase: c.ventas, excluidas: 0, ajustes: 0,
    compras: c.compras, traslados: c.traslados, invIni: c.invIni, invFin: c.invFin,
    mv: c.mv, pct: d(c.mv, c.ventas), utilidad: c.ventas - c.mv, pctUtil: d(c.ventas - c.mv, c.ventas),
    completo: c.completo, heredado: c.heredado, fIni: c.fIni, fFin: c.fFin, tieneIni: c.tieneIni, tieneFin: c.tieneFin,
  };
}
export type Cifras = ReturnType<typeof cifras>;
