// Lectura del archivo "Cierre de mes CP" (misma lógica del tablero cierre-de-mes-cp).
// Hojas: Compras, Fabricaciones, Traslados_Sedes, Inventario_CP (Inv Final), Base_Conversion, Costos_Compartidos_CP.
import * as XLSX from "xlsx";
import { arreglarTexto, fecha as leerFecha, normalizar, numero } from "../importador";

export type MarcaCP = "San Agustín" | "Rocoto";
export type TipoCP = "compras" | "fabricaciones" | "traslados" | "inventarios" | "base_conversion" | "costos";

export type HojaCP = {
  hoja: string;
  tipo: TipoCP;
  filasLeidas: number;
  descartadas: number; // filas de otras sedes/marcas o sin datos
  duplicadas: number; // solo compras
  desde: string | null;
  hasta: string | null;
  filas: Record<string, unknown>[];
};

const t = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = arreglarTexto(String(v)).replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
};

/** "San Agustin", "SAN AGUSTÍN" → San Agustín · "Rocoto", "Rocotoco" → Rocoto */
export function marcaCP(v: unknown): MarcaCP | null {
  const n = normalizar(v);
  if (n.startsWith("rocoto")) return "Rocoto";
  if (n.includes("san agustin")) return "San Agustín";
  return null;
}

export function tipoHojaCP(nombre: string): TipoCP | null {
  const n = normalizar(nombre).replace(/_/g, " ");
  if (n.includes("costos compartidos") || n.includes("costo compartido")) return "costos";
  if (n.includes("base conversion") || n.includes("conversion")) return "base_conversion";
  if (n.includes("fabricacion")) return "fabricaciones";
  if (n.includes("traslado")) return "traslados";
  if (n.includes("inv final") || n.includes("inventario")) return "inventarios";
  if (n.includes("compra")) return "compras";
  return null;
}

function indice(enc: string[], ...opciones: string[]): number {
  for (const o of opciones) {
    const i = enc.findIndex((h) => h === o);
    if (i >= 0) return i;
  }
  for (const o of opciones) {
    if (o.length < 4) continue;
    const i = enc.findIndex((h) => h.startsWith(o));
    if (i >= 0) return i;
  }
  return -1;
}

export function procesarHojaCP(nombre: string, filasCrudas: unknown[][], tipo: TipoCP): HojaCP {
  const res: HojaCP = { hoja: nombre, tipo, filasLeidas: 0, descartadas: 0, duplicadas: 0, desde: null, hasta: null, filas: [] };
  const enc = (filasCrudas[0] ?? []).map((h) => normalizar(h));
  const datos = filasCrudas.slice(1).filter((r) => r && r.some((v) => v !== null && v !== undefined && v !== ""));
  res.filasLeidas = datos.length;
  const marcar = (f: string) => {
    if (!res.desde || f < res.desde) res.desde = f;
    if (!res.hasta || f > res.hasta) res.hasta = f;
  };
  const g = (r: unknown[], i: number) => (i >= 0 ? r[i] : null);

  if (tipo === "compras") {
    // Marca según el almacén: CENTRO DE PRODUCCION → San Agustín, PLANTA PRODUCCIÓN ROCOTO → Rocoto. Lo demás se descarta.
    const iF = indice(enc, "fecha2", "fecha"), iA = indice(enc, "almacen"), iS = indice(enc, "serie / numero", "serie/numero"),
      iT = indice(enc, "tipo documento"), iN = indice(enc, "nif"), iP = indice(enc, "proveedor"), iFa = indice(enc, "familia"),
      iC = indice(enc, "centro de costos", "centro de costo", "cc"), iAr = indice(enc, "articulo"), iSu = indice(enc, "subarticulo"),
      iU = indice(enc, "uds.c", "uds"), iV = indice(enc, "valor unitario con impuesto", "valor unitario"), iTo = indice(enc, "total neto", "total");
    const vistos = new Set<string>();
    for (const r of datos) {
      const almacen = t(g(r, iA));
      if (!almacen) { res.descartadas++; continue; }
      const an = normalizar(almacen);
      const marca: MarcaCP | null = an.includes("centro de produccion") ? "San Agustín" : an.includes("planta produccion rocoto") ? "Rocoto" : null;
      if (!marca) { res.descartadas++; continue; }
      const f = leerFecha(g(r, iF));
      if (!f) { res.descartadas++; continue; }
      const serie = t(g(r, iS)), articulo = t(g(r, iAr));
      const uds = numero(g(r, iU)), vu = numero(g(r, iV)), total = numero(g(r, iTo));
      const clave = [almacen, serie, articulo, uds, vu, total].join("|");
      if (vistos.has(clave)) { res.duplicadas++; continue; }
      vistos.add(clave);
      marcar(f);
      res.filas.push({
        marca, fecha: f, almacen, serie, tipo_documento: t(g(r, iT)), nif: t(g(r, iN)), proveedor: t(g(r, iP)),
        familia: t(g(r, iFa)), centro_costos: t(g(r, iC)), articulo, subarticulo: t(g(r, iSu)),
        unidades: uds, valor_unitario: vu, total,
      });
    }
  } else if (tipo === "fabricaciones") {
    const iM = indice(enc, "marca"), iF = indice(enc, "fecha doc", "fecha"), iS = indice(enc, "serie / numero", "serie"),
      iA = indice(enc, "almacen"), iFa = indice(enc, "familia"), iCo = indice(enc, "cod. barras", "codigo"),
      iAf = indice(enc, "artifabri"), iAi = indice(enc, "artinsumo"), iU = indice(enc, "subarticulo", "unidad"),
      iQ = indice(enc, "variacion stock"), iCu = indice(enc, "coste unitario"), iCv = indice(enc, "coste variacion");
    for (const r of datos) {
      const marca = marcaCP(g(r, iM));
      const f = leerFecha(g(r, iF));
      if (!marca || !f) { res.descartadas++; continue; }
      marcar(f);
      res.filas.push({
        marca, fecha: f, serie: t(g(r, iS)), almacen: t(g(r, iA)), familia: t(g(r, iFa)), codigo: t(g(r, iCo)),
        artifabri: t(g(r, iAf)), artinsumo: t(g(r, iAi)), unidad: t(g(r, iU)),
        cantidad: numero(g(r, iQ)), costo_unitario: numero(g(r, iCu)), costo: numero(g(r, iCv)),
      });
    }
  } else if (tipo === "traslados") {
    // La sede que recibe viene en "Almacén Destino" o, si está vacía, en "Almacén".
    const iM = indice(enc, "marca"), iF = indice(enc, "fecha doc", "fecha"), iS = indice(enc, "serie / numero", "serie"),
      iA = indice(enc, "almacen"), iAd = indice(enc, "almacen destino"), iFa = indice(enc, "familia"), iAr = indice(enc, "articulo"),
      iU = indice(enc, "subarticulo"), iT = indice(enc, "tipo documento"), iMo = indice(enc, "motivo traspaso", "motivo"),
      iQ = indice(enc, "variacion stock"), iC = indice(enc, "coste unitario", "coste"), iCv = indice(enc, "coste variacion");
    for (const r of datos) {
      const marca = marcaCP(g(r, iM));
      const f = leerFecha(g(r, iF));
      if (!marca || !f) { res.descartadas++; continue; }
      marcar(f);
      res.filas.push({
        marca, fecha: f, serie: t(g(r, iS)), sede_destino: t(g(r, iAd)) ?? t(g(r, iA)), familia: t(g(r, iFa)),
        articulo: t(g(r, iAr)), unidad: t(g(r, iU)), tipo_documento: t(g(r, iT)), motivo: t(g(r, iMo)),
        cantidad: numero(g(r, iQ)), costo_unitario: numero(g(r, iC)), costo: numero(g(r, iCv)),
      });
    }
  } else if (tipo === "inventarios") {
    // Posiciones verificadas contra el archivo real (los encabezados de esta hoja están corridos):
    // Marca, Fecha, Mes, Serie, Almacén, Familia, Categoría, Artículo, Unidad, Coste línea, Stock a fecha, Variación, Stock inventario, Total
    for (const r of datos) {
      const marca = marcaCP(r[0]);
      const f = leerFecha(r[1]);
      if (!marca || !f) { res.descartadas++; continue; }
      marcar(f);
      res.filas.push({
        marca, fecha: f, serie: t(r[3]), almacen: t(r[4]), familia: t(r[5]), categoria: t(r[6]), articulo: t(r[7]), unidad: t(r[8]),
        costo_linea: numero(r[9]), stock_fecha: numero(r[10]), variacion: numero(r[11]), stock_inventario: numero(r[12]), total: numero(r[13]),
      });
    }
  } else if (tipo === "base_conversion") {
    const iC = indice(enc, "codigo"), iA = indice(enc, "articulo"), iU = indice(enc, "unidad"), iF = indice(enc, "unidad de conversion", "factor");
    for (const r of datos) {
      res.filas.push({ codigo: t(g(r, iC)), articulo: t(g(r, iA)), unidad: t(g(r, iU)), factor: numero(g(r, iF)) || 1 });
    }
  } else if (tipo === "costos") {
    // Formato: Mes | Concepto | Valor  (también acepta Fecha | … | Total)
    const iMes = indice(enc, "mes", "fecha"), iCon = indice(enc, "concepto", "motivo", "proveedor"), iV = indice(enc, "valor", "total");
    for (const r of datos) {
      const v = g(r, iMes);
      let mes: string | null = null;
      if (typeof v === "string" && /^\d{4}-\d{1,2}/.test(v.trim())) {
        const [y, m] = v.trim().split("-");
        mes = `${y}-${m.padStart(2, "0")}`;
      } else {
        const f = leerFecha(v);
        mes = f ? f.slice(0, 7) : null;
      }
      const valor = numero(g(r, iV));
      if (!mes || !valor) { res.descartadas++; continue; }
      marcar(`${mes}-01`);
      res.filas.push({ mes, concepto: t(g(r, iCon)) ?? "Sin concepto", valor });
    }
  }
  return res;
}

export function leerArchivoCP(datos: ArrayBuffer): { hojas: HojaCP[]; ignoradas: string[] } {
  const wb = XLSX.read(datos, { type: "array", cellDates: true, dense: true });
  const hojas: HojaCP[] = [];
  const ignoradas: string[] = [];
  for (const nombre of wb.SheetNames) {
    const tipo = tipoHojaCP(nombre);
    if (!tipo) { ignoradas.push(nombre); continue; }
    const filas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nombre], { header: 1, raw: true, defval: null, blankrows: false });
    hojas.push(procesarHojaCP(nombre, filas, tipo));
  }
  return { hojas, ignoradas };
}
