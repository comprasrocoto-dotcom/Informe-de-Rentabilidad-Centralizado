// Lectura del archivo "Cierre de mes CP" (misma lógica del tablero cierre-de-mes-cp).
// Hojas: Compras, Fabricaciones, Traslados_Sedes, Inventario_CP (Inv Final), Base_Conversion, Costos_Compartidos_CP.
import * as XLSX from "xlsx";
import { arreglarTexto, decodificarTexto, detectarSeparador, esArchivoPlano, fecha as leerFecha, normalizar, numero } from "../importador";

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

/** Marca según el almacén: CENTRO DE PRODUCCION → San Agustín, PLANTA PRODUCCIÓN ROCOTO → Rocoto */
export function marcaPorAlmacen(v: unknown): MarcaCP | null {
  const an = normalizar(v);
  if (an.includes("planta produccion rocoto")) return "Rocoto";
  if (an.includes("centro de produccion")) return "San Agustín";
  return null;
}

/** En traslados, la marca se deduce de la sede que recibe: sedes ROCOTO → Rocoto; sedes de 123 WOK → San Agustín */
export function marcaPorSedeDestino(v: unknown): MarcaCP | null {
  const n = normalizar(v);
  if (!n) return null;
  if (n.includes("rocoto")) return "Rocoto";
  if (/(123 ?wok|oviedo|interplaza|tesoro|^laureles$)/.test(n)) return "San Agustín";
  return null;
}

export type OpcionesCP = { tipoForzado?: TipoCP | null; marcaForzada?: MarcaCP | null; decimalComa?: boolean };

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

export function procesarHojaCP(nombre: string, filasCrudas: unknown[][], tipo: TipoCP, op: OpcionesCP = {}): HojaCP {
  const num = (v: unknown) => numero(v, op.decimalComa);
  // Marca: columna "Marca" si la hay; si no, por el almacén; si no, la que se eligió al subir
  const marcaDe = (vMarca: unknown, ...almacenes: unknown[]): MarcaCP | null =>
    marcaCP(vMarca) ?? almacenes.map(marcaPorAlmacen).find((x) => x) ?? op.marcaForzada ?? null;
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
      const marca: MarcaCP | null = marcaPorAlmacen(almacen);
      if (!marca) { res.descartadas++; continue; }
      const f = leerFecha(g(r, iF));
      if (!f) { res.descartadas++; continue; }
      const serie = t(g(r, iS)), articulo = t(g(r, iAr));
      const uds = num(g(r, iU)), vu = num(g(r, iV)), total = num(g(r, iTo));
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
      const marca = marcaDe(g(r, iM), g(r, iA));
      const f = leerFecha(g(r, iF));
      if (!marca || !f) { res.descartadas++; continue; }
      marcar(f);
      res.filas.push({
        marca, fecha: f, serie: t(g(r, iS)), almacen: t(g(r, iA)), familia: t(g(r, iFa)), codigo: t(g(r, iCo)),
        artifabri: t(g(r, iAf)), artinsumo: t(g(r, iAi)), unidad: t(g(r, iU)),
        cantidad: num(g(r, iQ)), costo_unitario: num(g(r, iCu)), costo: num(g(r, iCv)),
      });
    }
  } else if (tipo === "traslados") {
    // La sede que recibe viene en "Almacén Destino" o, si está vacía, en "Almacén".
    const iM = indice(enc, "marca"), iF = indice(enc, "fecha doc", "fecha"), iS = indice(enc, "serie / numero", "serie"),
      iA = indice(enc, "almacen"), iAd = indice(enc, "almacen destino"), iFa = indice(enc, "familia"), iAr = indice(enc, "articulo"),
      iU = indice(enc, "subarticulo"), iT = indice(enc, "tipo documento"), iMo = indice(enc, "motivo traspaso", "motivo"),
      iQ = indice(enc, "variacion stock"), iC = indice(enc, "coste unitario", "coste"), iCv = indice(enc, "coste variacion"),
      iAo = indice(enc, "almacen origen");
    for (const r of datos) {
      // Marca: columna Marca → almacén de origen del CP → sede que recibe → la elegida al subir
      const marca = marcaCP(g(r, iM)) ?? marcaPorAlmacen(g(r, iAo)) ?? marcaPorSedeDestino(g(r, iAd) ?? g(r, iA)) ?? op.marcaForzada ?? null;
      const f = leerFecha(g(r, iF));
      if (!marca || !f) { res.descartadas++; continue; }
      marcar(f);
      res.filas.push({
        marca, fecha: f, serie: t(g(r, iS)), sede_destino: t(g(r, iAd)) ?? t(g(r, iA)), familia: t(g(r, iFa)),
        articulo: t(g(r, iAr)), unidad: t(g(r, iU)), tipo_documento: t(g(r, iT)), motivo: t(g(r, iMo)),
        cantidad: num(g(r, iQ)), costo_unitario: num(g(r, iC)), costo: num(g(r, iCv)),
      });
    }
  } else if (tipo === "inventarios" && !enc.includes("articulo")) {
    // Hoja Inventario_CP del cierre: los encabezados están corridos, se lee por posición (verificado contra el archivo real):
    // Marca, Fecha, Mes, Serie, Almacén, Familia, Categoría, Artículo, Unidad, Coste línea, Stock a fecha, Variación, Stock inventario, Total
    for (const r of datos) {
      const marca = marcaDe(r[0], r[4]);
      const f = leerFecha(r[1]);
      if (!marca || !f) { res.descartadas++; continue; }
      marcar(f);
      res.filas.push({
        marca, fecha: f, serie: t(r[3]), almacen: t(r[4]), familia: t(r[5]), categoria: t(r[6]), articulo: t(r[7]), unidad: t(r[8]),
        costo_linea: num(r[9]), stock_fecha: num(r[10]), variacion: num(r[11]), stock_inventario: num(r[12]), total: num(r[13]),
      });
    }
  } else if (tipo === "inventarios") {
    // Archivo de inventario independiente (exportado del ERP): se lee por nombre de columna
    const iM = indice(enc, "marca"), iF = indice(enc, "fecha doc", "fecha"), iS = indice(enc, "serie / numero", "serie"),
      iA = indice(enc, "almacen"), iFa = indice(enc, "familia"), iCa = indice(enc, "categoria", "subfamilia", "centro de costos"),
      iAr = indice(enc, "articulo"), iU = indice(enc, "unidad", "subarticulo"), iCl = indice(enc, "coste linea", "coste unitario", "costo unitario"),
      iSf = indice(enc, "stock a fecha"), iV = indice(enc, "variacion stock"), iSi = indice(enc, "stock inventario"), iT = indice(enc, "total");
    for (const r of datos) {
      const marca = marcaDe(g(r, iM), g(r, iA));
      const f = leerFecha(g(r, iF));
      if (!marca || !f) { res.descartadas++; continue; }
      marcar(f);
      res.filas.push({
        marca, fecha: f, serie: t(g(r, iS)), almacen: t(g(r, iA)), familia: t(g(r, iFa)), categoria: t(g(r, iCa)), articulo: t(g(r, iAr)), unidad: t(g(r, iU)),
        costo_linea: num(g(r, iCl)), stock_fecha: num(g(r, iSf)), variacion: num(g(r, iV)), stock_inventario: num(g(r, iSi)), total: num(g(r, iT)),
      });
    }
  } else if (tipo === "base_conversion") {
    const iC = indice(enc, "codigo"), iA = indice(enc, "articulo"), iU = indice(enc, "unidad"), iF = indice(enc, "unidad de conversion", "factor");
    for (const r of datos) {
      res.filas.push({ codigo: t(g(r, iC)), articulo: t(g(r, iA)), unidad: t(g(r, iU)), factor: num(g(r, iF)) || 1 });
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
      const valor = num(g(r, iV));
      if (!mes || !valor) { res.descartadas++; continue; }
      marcar(`${mes}-01`);
      res.filas.push({ mes, concepto: t(g(r, iCon)) ?? "Sin concepto", valor });
    }
  }
  return res;
}

/**
 * Lee un archivo del CP. Sin `tipoForzado` se espera el libro de cierre (cada hoja se reconoce por su nombre).
 * Con `tipoForzado` (archivo independiente) se lee esa información de la hoja que la contenga o, si ninguna se
 * llama así, de la primera hoja con datos. Acepta Excel y archivo plano (.csv / .txt).
 */
export function leerArchivoCP(datos: ArrayBuffer, nombreArchivo = "archivo.xlsx", op: OpcionesCP = {}): { hojas: HojaCP[]; ignoradas: string[] } {
  if (esArchivoPlano(nombreArchivo)) {
    const texto = decodificarTexto(datos);
    const sep = detectarSeparador(texto);
    const tipo = op.tipoForzado ?? tipoHojaCP(nombreArchivo);
    if (!tipo) return { hojas: [], ignoradas: [nombreArchivo] };
    const wb = XLSX.read(texto, { type: "string", FS: sep, raw: true, dense: true });
    const filas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null, blankrows: false });
    return { hojas: [procesarHojaCP(nombreArchivo, filas, tipo, { ...op, decimalComa: sep === ";" })], ignoradas: [] };
  }
  const wb = XLSX.read(datos, { type: "array", cellDates: true, dense: true });
  const leer = (n: string) => XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: false });
  if (op.tipoForzado) {
    const nombre = wb.SheetNames.find((n) => tipoHojaCP(n) === op.tipoForzado) ?? wb.SheetNames.find((n) => leer(n).length > 1) ?? wb.SheetNames[0];
    return { hojas: [procesarHojaCP(nombre, leer(nombre), op.tipoForzado, op)], ignoradas: wb.SheetNames.filter((n) => n !== nombre) };
  }
  const hojas: HojaCP[] = [];
  const ignoradas: string[] = [];
  for (const nombre of wb.SheetNames) {
    const tipo = tipoHojaCP(nombre);
    if (!tipo) { ignoradas.push(nombre); continue; }
    hojas.push(procesarHojaCP(nombre, leer(nombre), tipo, op));
  }
  return { hojas, ignoradas };
}
