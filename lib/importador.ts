// Lectura de los Excel de informes (Ventas, Compras, Inventarios, Traslados, Rentabilidad).
// Cada marca usa nombres de columna un poco distintos y algunos archivos traen
// acentos dañados ("AlmacÃ©n"); aquí se normaliza todo a un formato único.
import * as XLSX from "xlsx";

export type TipoHoja = "ventas" | "compras" | "inventarios" | "traslados" | "rentabilidad";

export type FilaVenta = {
  sede: string; fecha: string; tarifa: string | null; tipo_documento: string | null;
  familia: string | null; centro_costos: string | null; articulo: string | null;
  lineas: number; unidades: number; subtotal: number; descuento: number;
  base: number; impuestos: number; neto: number;
};
export type FilaCompra = {
  sede: string; fecha: string; serie: string | null; tipo_documento: string | null;
  serie_origen: string | null; nif: string | null; proveedor: string | null; familia: string | null;
  centro_costos: string | null; articulo: string | null; subarticulo: string | null;
  unidades: number; valor_unitario: number; total: number;
};
export type FilaInventario = {
  sede: string; fecha: string; serie: string | null; familia: string | null; subfamilia: string | null;
  centro_costos: string | null; proveedor: string | null; articulo: string | null; codigo: string | null;
  subarticulo: string | null; costo_unitario: number; stock_fecha: number; variacion: number;
  stock_inventario: number; total: number;
};
export type FilaTraslado = {
  sede: string; fecha: string; serie: string | null; familia: string | null; centro_costos: string | null;
  articulo: string | null; subarticulo: string | null; tipo_documento: string | null; motivo: string | null;
  variacion: number; costo_unitario: number; total: number;
};
export type FilaRentabilidad = {
  grupo: string | null; tarifa: string | null; familia: string | null; centro_costos: string | null;
  articulo: string | null; referencia: string | null; precio: number; impuesto: number; base: number; coste: number;
};

export type ResultadoHoja = {
  hoja: string;
  tipo: TipoHoja;
  filasLeidas: number;
  filasOmitidas: number;
  motivosOmision: Record<string, number>;
  desde: string | null;
  hasta: string | null;
  sedes: string[]; // nombres normalizados de Establecimiento / Almacén encontrados
  filas: (FilaVenta | FilaCompra | FilaInventario | FilaTraslado | FilaRentabilidad)[];
};

// ---------- utilidades de texto ----------
export function arreglarTexto(s: string): string {
  if (!/[ÃÂâ]/.test(s)) return s;
  try {
    const bytes = new Uint8Array([...s].map((c) => {
      const code = c.charCodeAt(0);
      if (code < 256) return code;
      // caracteres cp1252 que no están en latin1
      const cp1252: Record<number, number> = { 0x20ac: 0x80, 0x201a: 0x82, 0x192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x2c6: 0x88, 0x2030: 0x89, 0x160: 0x8a, 0x2039: 0x8b, 0x152: 0x8c, 0x17d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x2dc: 0x98, 0x2122: 0x99, 0x161: 0x9a, 0x203a: 0x9b, 0x153: 0x9c, 0x17e: 0x9e, 0x178: 0x9f };
      if (cp1252[code] !== undefined) return cp1252[code];
      throw new Error("no latin1");
    }));
    const out = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return out;
  } catch {
    return s;
  }
}

export function normalizar(s: unknown): string {
  return arreglarTexto(String(s ?? ""))
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

/** Nombre de sede normalizado: MAYÚSCULAS, sin tildes, espacios simples */
export function normalizarSede(s: unknown): string {
  return normalizar(s).toUpperCase();
}

function texto(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const t = arreglarTexto(String(v)).replace(/\s+/g, " ").trim();
  return t === "" ? null : t;
}

/**
 * Convierte texto a número aceptando formato colombiano (1.234.567,89) y estadounidense (1,234,567.89).
 * `decimalComa`: el archivo usa coma decimal (archivos planos separados por ;), así "1.143" se lee como 1143.
 */
export function numero(v: unknown, decimalComa = false): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v === null || v === undefined) return 0;
  let s = String(v).trim();
  if (s === "" || s === "-" || s.startsWith("#")) return 0;
  s = s.replace(/\$/g, "").replace(/\s/g, "");
  const negParentesis = /^\(.*\)$/.test(s);
  if (negParentesis) s = s.slice(1, -1);
  const comas = (s.match(/,/g) || []).length;
  const puntos = (s.match(/\./g) || []).length;
  if (comas && puntos) {
    // el último separador es el decimal
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (comas) {
    s = comas > 1 ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (puntos) {
    if (puntos > 1 || (decimalComa && /^-?\d{1,3}\.\d{3}$/.test(s))) s = s.replace(/\./g, "");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return negParentesis ? -n : n;
}

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const MESES: Record<string, number> = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };
export function mesDeTexto(v: unknown): number | null {
  const n = normalizar(v).slice(0, 3);
  return MESES[n] ?? null;
}

const HOY = () => new Date().toISOString().slice(0, 10);

/** Fecha con validación: si queda en el futuro, intenta invertir día y mes (error típico de digitación). */
export function fechaValidada(v: unknown, mesHint: number | null): string | null {
  const f = fecha(v, mesHint);
  if (!f) return null;
  if (f <= HOY()) return f;
  const [y, m, d] = f.split("-").map(Number);
  const inv = d <= 12 ? iso(y, d, m) : null;
  return inv && inv <= HOY() ? inv : null;
}

export function fecha(v: unknown, mesHint: number | null = null): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    // SheetJS crea fechas en hora local; se toma la fecha calendario (sumando 12h evita saltos por zona horaria)
    const d = new Date(v.getTime() + 12 * 3600 * 1000);
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  if (typeof v === "number") {
    if (v < 20000 || v > 80000) return null; // número de serie de Excel
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (m) {
    const a = +m[1], b = +m[2], y = +m[3];
    if (a > 12) return iso(y, b, a); // d/m/a
    if (b > 12) return iso(y, a, b); // m/d/a
    if (mesHint === a && mesHint !== b) return iso(y, a, b); // la columna Mes indica m/d/a
    return iso(y, b, a); // por defecto día/mes/año (Colombia)
  }
  if (/^\d+(\.\d+)?$/.test(s)) return fecha(Number(s));
  return null;
}

// ---------- detección de hojas y columnas ----------
export function tipoDeHoja(nombre: string): TipoHoja | null {
  const n = normalizar(nombre);
  if (n.includes("inventario")) return "inventarios"; // va primero: "inVENTArio" contiene "venta"
  if (n.includes("venta")) return "ventas";
  if (n.includes("compra")) return "compras";
  if (n.includes("traslado")) return "traslados";
  if (n.includes("rentabilidad")) return "rentabilidad";
  return null;
}

type Columnas = Record<string, number>;

// Para cada campo: lista de encabezados posibles (normalizados). Se toma la primera coincidencia exacta,
// y si no hay, la primera que empiece igual.
const CAMPOS: Record<TipoHoja, Record<string, string[]>> = {
  ventas: {
    mes: ["mes"],
    sede: ["establecimiento", "almacen"],
    tarifa: ["tarifa venta", "tarifa"],
    tipo_documento: ["tipo documento"],
    fecha: ["fecha doc", "fecha"],
    familia: ["familia"],
    centro_costos: ["centro de costos", "centro de costo", "cc", "centro"],
    articulo: ["articulo"],
    unidades: ["uds.v", "uds"],
    subtotal: ["subtotal"],
    descuento: ["importe descuento"],
    base: ["base"],
    impuestos: ["impuestos", "impuesto"],
    neto: ["neto"],
  },
  compras: {
    mes: ["mes"],
    sede: ["almacen"],
    fecha: ["fecha"],
    serie: ["serie / numero", "serie/numero"],
    tipo_documento: ["tipo documento"],
    serie_origen: ["serie/numero origen", "serie / numero origen"],
    nif: ["nif"],
    proveedor: ["proveedor"],
    familia: ["familia"],
    centro_costos: ["cc", "centro de costos", "centro de costo", "centro"],
    articulo: ["articulo"],
    subarticulo: ["subarticulo"],
    unidades: ["uds.c", "uds"],
    valor_unitario: ["valor unitario con impuesto", "valor unitario"],
    total: ["total neto", "total"],
  },
  inventarios: {
    mes: ["mes"],
    sede: ["almacen"],
    fecha: ["fecha doc", "fecha"],
    serie: ["serie / numero", "serie"],
    familia: ["familia"],
    subfamilia: ["subfamilia"],
    centro_costos: ["centro de costos", "centro de costo", "centrp de costos", "cc", "centro"],
    proveedor: ["proveedor"],
    articulo: ["articulo"],
    codigo: ["cod. barras", "codigo"],
    subarticulo: ["subarticulo"],
    costo_unitario: ["coste linea", "coste unitario", "costo unitario"],
    stock_fecha: ["stock a fecha"],
    variacion: ["variacion stock"],
    stock_inventario: ["stock inventario"],
    total: ["total", "costo ajuste"],
  },
  traslados: {
    mes: ["mes"],
    sede: ["almacen"],
    fecha: ["fecha doc", "fecha"],
    serie: ["serie / numero", "serie"],
    familia: ["familia"],
    centro_costos: ["centro de costos", "centro de costo", "cc"],
    articulo: ["articulo"],
    subarticulo: ["subarticulo"],
    tipo_documento: ["tipo documento"],
    motivo: ["motivo traspaso", "motivo"],
    variacion: ["variacion stock"],
    costo_unitario: ["coste unitario", "coste"],
    total: ["coste variacion"],
  },
  rentabilidad: {
    grupo: ["grupo almacen"],
    tarifa: ["tarifa venta"],
    familia: ["familia"],
    centro_costos: ["centro de costos", "cc"],
    articulo: ["articulo"],
    referencia: ["referencia"],
    precio: ["precio"],
    impuesto: ["impuesto"],
    base: ["base"],
    coste: ["coste"],
  },
};

const OBLIGATORIOS: Record<TipoHoja, string[]> = {
  ventas: ["sede", "fecha", "articulo", "base"],
  compras: ["sede", "fecha", "articulo", "total"],
  inventarios: ["sede", "articulo", "total"],
  traslados: ["sede", "fecha", "articulo", "total"],
  rentabilidad: ["articulo", "precio", "coste"],
};

function mapearColumnas(encabezados: string[], tipo: TipoHoja): Columnas {
  const enc = encabezados.map(normalizar);
  const usados = new Set<number>();
  const cols: Columnas = {};
  for (const [campo, opciones] of Object.entries(CAMPOS[tipo])) {
    let idx = -1;
    for (const op of opciones) {
      idx = enc.findIndex((h, i) => !usados.has(i) && h === op);
      if (idx >= 0) break;
    }
    if (idx < 0) {
      for (const op of opciones) {
        if (op.length < 4) continue; // evitar "cc" o "uds" coincidiendo con cualquier cosa
        idx = enc.findIndex((h, i) => !usados.has(i) && h.startsWith(op));
        if (idx >= 0) break;
      }
    }
    if (idx >= 0) { cols[campo] = idx; usados.add(idx); }
  }
  return cols;
}

function buscarEncabezado(filas: unknown[][], tipo: TipoHoja): { fila: number; cols: Columnas } | null {
  for (let i = 0; i < Math.min(filas.length, 10); i++) {
    const r = (filas[i] || []).map((v) => (v === null || v === undefined ? "" : String(v)));
    const cols = mapearColumnas(r, tipo);
    if (OBLIGATORIOS[tipo].every((c) => cols[c] !== undefined)) return { fila: i, cols };
  }
  return null;
}

// ---------- procesamiento ----------
export type OpcionesImportacion = {
  /** Fecha a usar cuando una fila de inventario no trae fecha válida (ej. "######") */
  fechaRespaldo?: string | null;
  /** El archivo usa coma decimal (se activa solo para archivos planos separados por ;) */
  decimalComa?: boolean;
};

export function procesarHoja(nombreHoja: string, filas: unknown[][], tipo: TipoHoja, op: OpcionesImportacion = {}): ResultadoHoja {
  const res: ResultadoHoja = {
    hoja: nombreHoja, tipo, filasLeidas: 0, filasOmitidas: 0, motivosOmision: {},
    desde: null, hasta: null, sedes: [], filas: [],
  };
  const enc = buscarEncabezado(filas, tipo);
  if (!enc) {
    throw new Error(`No se encontraron las columnas necesarias en la hoja "${nombreHoja}" (${OBLIGATORIOS[tipo].join(", ")}).`);
  }
  const c = enc.cols;
  const num = (v: unknown) => numero(v, !!op.decimalComa);
  const get = (r: unknown[], campo: string) => (c[campo] === undefined ? null : r[c[campo]]);
  const omitir = (motivo: string) => {
    res.filasOmitidas++;
    res.motivosOmision[motivo] = (res.motivosOmision[motivo] || 0) + 1;
  };
  const sedes = new Set<string>();
  const marcarFecha = (f: string) => {
    if (!res.desde || f < res.desde) res.desde = f;
    if (!res.hasta || f > res.hasta) res.hasta = f;
  };
  const agregadas = new Map<string, FilaVenta>();

  for (let i = enc.fila + 1; i < filas.length; i++) {
    const r = filas[i];
    if (!r || r.every((v) => v === null || v === undefined || v === "")) continue;
    res.filasLeidas++;

    if (tipo === "rentabilidad") {
      const articulo = texto(get(r, "articulo"));
      if (!articulo) { omitir("Sin artículo"); continue; }
      res.filas.push({
        grupo: texto(get(r, "grupo")), tarifa: texto(get(r, "tarifa")), familia: texto(get(r, "familia")),
        centro_costos: texto(get(r, "centro_costos")), articulo, referencia: texto(get(r, "referencia")),
        precio: num(get(r, "precio")), impuesto: num(get(r, "impuesto")),
        base: num(get(r, "base")), coste: num(get(r, "coste")),
      } as FilaRentabilidad);
      continue;
    }

    const sede = normalizarSede(get(r, "sede"));
    if (!sede) { omitir("Sin establecimiento / almacén"); continue; }
    let f = fechaValidada(get(r, "fecha"), mesDeTexto(get(r, "mes")));
    if (!f && tipo === "inventarios" && op.fechaRespaldo) f = op.fechaRespaldo;
    if (!f) { omitir("Fecha vacía, futura o no válida"); continue; }
    sedes.add(sede);
    marcarFecha(f);

    if (tipo === "ventas") {
      const fila: FilaVenta = {
        sede, fecha: f, tarifa: texto(get(r, "tarifa")), tipo_documento: texto(get(r, "tipo_documento")),
        familia: texto(get(r, "familia")), centro_costos: texto(get(r, "centro_costos")), articulo: texto(get(r, "articulo")),
        lineas: 1, unidades: num(get(r, "unidades")), subtotal: num(get(r, "subtotal")),
        descuento: num(get(r, "descuento")), base: num(get(r, "base")),
        impuestos: num(get(r, "impuestos")), neto: num(get(r, "neto")),
      };
      if (c.subtotal === undefined) fila.subtotal = fila.neto;
      const k = [sede, f, fila.tarifa, fila.tipo_documento, fila.familia, fila.centro_costos, fila.articulo].join("\u0001");
      const ya = agregadas.get(k);
      if (ya) {
        ya.lineas++; ya.unidades += fila.unidades; ya.subtotal += fila.subtotal; ya.descuento += fila.descuento;
        ya.base += fila.base; ya.impuestos += fila.impuestos; ya.neto += fila.neto;
      } else agregadas.set(k, fila);
    } else if (tipo === "compras") {
      res.filas.push({
        sede, fecha: f, serie: texto(get(r, "serie")), tipo_documento: texto(get(r, "tipo_documento")),
        serie_origen: texto(get(r, "serie_origen")), nif: texto(get(r, "nif")), proveedor: texto(get(r, "proveedor")),
        familia: texto(get(r, "familia")), centro_costos: texto(get(r, "centro_costos")), articulo: texto(get(r, "articulo")),
        subarticulo: texto(get(r, "subarticulo")), unidades: num(get(r, "unidades")),
        valor_unitario: num(get(r, "valor_unitario")), total: num(get(r, "total")),
      } as FilaCompra);
    } else if (tipo === "inventarios") {
      res.filas.push({
        sede, fecha: f, serie: texto(get(r, "serie")), familia: texto(get(r, "familia")), subfamilia: texto(get(r, "subfamilia")),
        centro_costos: texto(get(r, "centro_costos")), proveedor: texto(get(r, "proveedor")), articulo: texto(get(r, "articulo")),
        codigo: texto(get(r, "codigo")), subarticulo: texto(get(r, "subarticulo")),
        costo_unitario: num(get(r, "costo_unitario")), stock_fecha: num(get(r, "stock_fecha")),
        variacion: num(get(r, "variacion")), stock_inventario: num(get(r, "stock_inventario")),
        total: num(get(r, "total")),
      } as FilaInventario);
    } else if (tipo === "traslados") {
      res.filas.push({
        sede, fecha: f, serie: texto(get(r, "serie")), familia: texto(get(r, "familia")),
        centro_costos: texto(get(r, "centro_costos")), articulo: texto(get(r, "articulo")),
        subarticulo: texto(get(r, "subarticulo")), tipo_documento: texto(get(r, "tipo_documento")),
        motivo: texto(get(r, "motivo")), variacion: num(get(r, "variacion")),
        costo_unitario: num(get(r, "costo_unitario")), total: num(get(r, "total")),
      } as FilaTraslado);
    }
  }
  if (tipo === "ventas") {
    for (const v of agregadas.values()) {
      for (const k of ["unidades", "subtotal", "descuento", "base", "impuestos", "neto"] as const) v[k] = Math.round(v[k] * 100) / 100;
      res.filas.push(v);
    }
  }
  res.sedes = [...sedes].sort();
  return res;
}

export type HojaDisponible = { nombre: string; tipo: TipoHoja | null };

/** Origen del archivo: Excel (binario) o archivo plano (CSV / TXT ya convertido a texto). */
export type Fuente = { clase: "excel"; datos: ArrayBuffer } | { clase: "plano"; texto: string; separador: string };

export const esArchivoPlano = (nombre: string) => /\.(csv|txt|tsv|prn)$/i.test(nombre);

/** Convierte los bytes de un archivo plano a texto: UTF-8 si es válido, si no Windows-1252 (Excel en español). */
export function decodificarTexto(datos: ArrayBuffer): string {
  let t: string;
  try {
    t = new TextDecoder("utf-8", { fatal: true }).decode(datos);
  } catch {
    t = new TextDecoder("windows-1252").decode(datos);
  }
  return t.replace(/^\uFEFF/, "");
}

/** Elige el separador más frecuente en las primeras líneas: ; , tabulación o | */
export function detectarSeparador(texto: string): string {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim()).slice(0, 5);
  const candidatos = [";", "\t", ",", "|"];
  let mejor = ";", max = -1;
  for (const c of candidatos) {
    const n = Math.min(...lineas.map((l) => l.split(c).length - 1));
    if (n > max) { max = n; mejor = c; }
  }
  return mejor;
}

export function crearFuente(nombreArchivo: string, datos: ArrayBuffer): Fuente {
  if (esArchivoPlano(nombreArchivo)) {
    const texto = decodificarTexto(datos);
    return { clase: "plano", texto, separador: detectarSeparador(texto) };
  }
  return { clase: "excel", datos };
}

const NOMBRE_HOJA_PLANA = "Archivo plano";

export function listarHojas(fuente: Fuente): HojaDisponible[] {
  if (fuente.clase === "plano") return [{ nombre: NOMBRE_HOJA_PLANA, tipo: null }];
  const wb = XLSX.read(fuente.datos, { type: "array", bookSheets: true });
  return wb.SheetNames.map((n) => ({ nombre: n, tipo: tipoDeHoja(n) }));
}

/**
 * Lee una hoja. Si se indica `tipoForzado` (el usuario eligió qué está subiendo),
 * se usa ese tipo sin importar cómo se llame la hoja.
 */
export function leerHoja(fuente: Fuente, nombreHoja: string, op: OpcionesImportacion = {}, tipoForzado?: TipoHoja | null): ResultadoHoja {
  const tipo = tipoForzado ?? tipoDeHoja(nombreHoja);
  if (!tipo) throw new Error(`No se reconoce el tipo de la hoja "${nombreHoja}". Elige arriba qué información estás subiendo.`);
  let filas: unknown[][];
  if (fuente.clase === "plano") {
    // raw: true deja los valores como texto; fechas y números los interpreta el importador (formato colombiano)
    const wb = XLSX.read(fuente.texto, { type: "string", FS: fuente.separador, raw: true, dense: true });
    filas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null, blankrows: false });
  } else {
    const wb = XLSX.read(fuente.datos, { type: "array", sheets: nombreHoja, cellDates: true, dense: true, cellFormula: false, cellHTML: false, cellText: false });
    filas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nombreHoja], { header: 1, raw: true, defval: null, blankrows: false });
  }
  const opciones = fuente.clase === "plano" && fuente.separador === ";" ? { ...op, decimalComa: true } : op;
  return procesarHoja(nombreHoja, filas, tipo, opciones);
}

/** Columnas que debe traer cada tipo de archivo (para la guía y las plantillas). */
export const GUIA_COLUMNAS: Record<TipoHoja, { obligatorias: string[]; opcionales: string[] }> = {
  ventas: {
    obligatorias: ["Establecimiento", "Fecha Doc", "Artículo", "Base"],
    opcionales: ["Tarifa Venta", "Tipo Documento", "Familia", "Centro de Costos", "Uds.V", "Subtotal", "Importe descuento", "Impuestos", "Neto"],
  },
  compras: {
    obligatorias: ["Almacén", "Fecha", "Artículo", "Total Neto"],
    opcionales: ["Serie / Número", "Tipo Documento", "Serie/Número Origen", "Nif", "Proveedor", "Familia", "CC", "Subartículo", "Uds.C", "Valor Unitario Con Impuesto"],
  },
  inventarios: {
    obligatorias: ["Almacén", "Fecha Doc", "Artículo", "Total"],
    opcionales: ["Serie / Número", "Familia", "Subfamilia", "Centro de Costos", "Proveedor", "Cód. Barras", "Subartículo", "Coste Línea", "Stock a Fecha", "Variación Stock", "Stock Inventario"],
  },
  traslados: {
    obligatorias: ["Almacén", "Fecha Doc", "Artículo", "Coste Variación"],
    opcionales: ["Serie / Número", "Familia", "Centro de Costos", "Subartículo", "Tipo Documento", "Motivo Traspaso", "Variación Stock", "Coste Unitario"],
  },
  rentabilidad: {
    obligatorias: ["Artículo", "Precio", "Coste"],
    opcionales: ["Grupo Almacén", "Tarifa Venta", "Familia", "Centro de Costos", "Referencia", "Impuesto", "Base"],
  },
};
