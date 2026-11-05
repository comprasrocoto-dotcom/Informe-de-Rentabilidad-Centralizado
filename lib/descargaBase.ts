// Descarga de la base de datos a Excel o CSV. Lee por páginas de 1.000 filas (el tope de Supabase) y respeta
// el acceso por marca (cada usuario solo baja lo de sus marcas).
import type { SupabaseClient } from "@supabase/supabase-js";

export type TablaBase = "compras" | "ventas" | "ventas_facturas" | "inventarios" | "traslados" | "rentabilidad_items";

type Col = [campo: string, titulo: string];
const COMUNES: Col[] = [["marca", "Marca"], ["sede", "Sede"], ["fecha", "Fecha"]];
export const TABLAS: Record<TablaBase, { nombre: string; hoja: string; fecha: boolean; cols: Col[] }> = {
  compras: { nombre: "Compras", hoja: "Compras", fecha: true, cols: [...COMUNES, ["serie", "Serie"], ["tipo_documento", "Tipo documento"], ["serie_origen", "Serie origen"], ["nif", "NIF"], ["proveedor", "Proveedor"], ["familia", "Familia"], ["centro_costos", "Centro de costos"], ["articulo", "Artículo"], ["subarticulo", "Subartículo"], ["unidades", "Unidades"], ["valor_unitario", "Valor unitario"], ["total", "Total"]] },
  ventas: { nombre: "Ventas (por día y artículo)", hoja: "Ventas", fecha: true, cols: [...COMUNES, ["tarifa", "Tarifa"], ["tipo_documento", "Tipo documento"], ["familia", "Familia"], ["centro_costos", "Centro de costos"], ["cc_negocio", "Centro de negocio"], ["articulo", "Artículo"], ["lineas", "Líneas"], ["unidades", "Unidades"], ["subtotal", "Subtotal"], ["descuento", "Descuento"], ["base", "Base"], ["impuestos", "Impuestos"], ["neto", "Neto"], ["es_propina", "Es propina"]] },
  ventas_facturas: { nombre: "Facturas de venta", hoja: "Facturas", fecha: true, cols: [...COMUNES, ["serie", "Serie"], ["tipo_documento", "Tipo documento"], ["lineas", "Líneas"], ["base", "Base"], ["neto", "Neto"]] },
  inventarios: { nombre: "Inventarios", hoja: "Inventarios", fecha: true, cols: [...COMUNES, ["serie", "Serie"], ["familia", "Familia"], ["subfamilia", "Subfamilia"], ["centro_costos", "Centro de costos"], ["proveedor", "Proveedor"], ["codigo", "Código"], ["articulo", "Artículo"], ["subarticulo", "Subartículo"], ["costo_unitario", "Costo unitario"], ["stock_fecha", "Stock a la fecha"], ["variacion", "Variación"], ["stock_inventario", "Stock inventario"], ["total", "Total"]] },
  traslados: { nombre: "Traslados", hoja: "Traslados", fecha: true, cols: [...COMUNES, ["serie", "Serie"], ["tipo_documento", "Tipo documento"], ["motivo", "Motivo"], ["familia", "Familia"], ["centro_costos", "Centro de costos"], ["articulo", "Artículo"], ["subarticulo", "Subartículo"], ["variacion", "Cantidad"], ["costo_unitario", "Costo unitario"], ["total", "Total"]] },
  rentabilidad_items: { nombre: "Rentabilidad de carta", hoja: "Carta", fecha: false, cols: [["marca", "Marca"], ["grupo", "Grupo"], ["tarifa", "Tarifa"], ["familia", "Familia"], ["centro_costos", "Centro de costos"], ["referencia", "Referencia"], ["articulo", "Artículo"], ["precio", "Precio"], ["impuesto", "Impuesto"], ["base", "Base"], ["coste", "Coste ficha"]] },
};

// Mismos encabezados que reconoce el importador (GUIA_COLUMNAS): el archivo se puede volver a subir tal cual
export const PARA_SUBIR: Partial<Record<TablaBase, { hoja: string; cols: Col[] }>> = {
  compras: { hoja: "Compras", cols: [["sede", "Almacén"], ["fecha", "Fecha"], ["serie", "Serie / Número"], ["tipo_documento", "Tipo Documento"], ["serie_origen", "Serie/Número Origen"], ["nif", "Nif"], ["proveedor", "Proveedor"], ["familia", "Familia"], ["centro_costos", "CC"], ["articulo", "Artículo"], ["subarticulo", "Subartículo"], ["unidades", "Uds.C"], ["valor_unitario", "Valor Unitario Con Impuesto"], ["total", "Total Neto"]] },
  ventas: { hoja: "Ventas", cols: [["sede", "Establecimiento"], ["fecha", "Fecha Doc"], ["tarifa", "Tarifa Venta"], ["tipo_documento", "Tipo Documento"], ["familia", "Familia"], ["centro_costos", "Centro de Costos"], ["articulo", "Artículo"], ["unidades", "Uds.V"], ["subtotal", "Subtotal"], ["descuento", "Importe descuento"], ["base", "Base"], ["impuestos", "Impuestos"], ["neto", "Neto"]] },
  inventarios: { hoja: "Inventarios", cols: [["sede", "Almacén"], ["fecha", "Fecha Doc"], ["serie", "Serie / Número"], ["familia", "Familia"], ["subfamilia", "Subfamilia"], ["centro_costos", "Centro de Costos"], ["proveedor", "Proveedor"], ["codigo", "Cód. Barras"], ["articulo", "Artículo"], ["subarticulo", "Subartículo"], ["costo_unitario", "Coste Línea"], ["stock_fecha", "Stock a Fecha"], ["variacion", "Variación Stock"], ["stock_inventario", "Stock Inventario"], ["total", "Total"]] },
  traslados: { hoja: "Traslados", cols: [["sede", "Almacén"], ["fecha", "Fecha Doc"], ["serie", "Serie / Número"], ["tipo_documento", "Tipo Documento"], ["motivo", "Motivo Traspaso"], ["familia", "Familia"], ["centro_costos", "Centro de Costos"], ["articulo", "Artículo"], ["subarticulo", "Subartículo"], ["variacion", "Variación Stock"], ["costo_unitario", "Coste Unitario"], ["total", "Coste Variación"]] },
  rentabilidad_items: { hoja: "Rentabilidad", cols: [["grupo", "Grupo Almacén"], ["tarifa", "Tarifa Venta"], ["familia", "Familia"], ["centro_costos", "Centro de Costos"], ["referencia", "Referencia"], ["articulo", "Artículo"], ["precio", "Precio"], ["impuesto", "Impuesto"], ["base", "Base"], ["coste", "Coste"]] },
};

export type FiltroBase = { marcaId?: number | null; sedeId?: number | null; desde?: string; hasta?: string; cargaId?: number };
type Nombres = { marca: (id: number) => string; sede: (id: number) => string };

function consulta(sb: SupabaseClient, t: TablaBase, f: FiltroBase, select: string, opts?: { count: "exact"; head: true }) {
  let q = sb.from(t).select(select, opts);
  if (f.cargaId) q = q.eq("carga_id", f.cargaId);
  if (f.marcaId) q = q.eq("marca_id", f.marcaId);
  if (f.sedeId && t !== "rentabilidad_items") q = q.eq("sede_id", f.sedeId);
  if (TABLAS[t].fecha && f.desde) q = q.gte("fecha", f.desde);
  if (TABLAS[t].fecha && f.hasta) q = q.lte("fecha", f.hasta);
  return q;
}

export async function contar(sb: SupabaseClient, t: TablaBase, f: FiltroBase) {
  const { count, error } = await consulta(sb, t, f, "id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Trae todas las filas de una tabla, ya con nombre de marca y sede, en el orden de las columnas */
export async function traer(sb: SupabaseClient, t: TablaBase, f: FiltroBase, n: Nombres, progreso?: (leidas: number) => void, paraSubir = false) {
  const def = paraSubir && PARA_SUBIR[t] ? { ...TABLAS[t], cols: PARA_SUBIR[t]!.cols } : TABLAS[t];
  const campos = [...new Set(["id", "marca_id", ...(def.fecha ? ["sede_id"] : []), ...def.cols.map((c) => c[0]).filter((c) => c !== "marca" && c !== "sede")])];
  const filas: Record<string, unknown>[] = [];
  const PAG = 1000;
  for (let desde = 0; ; desde += PAG) {
    const { data, error } = await consulta(sb, t, f, campos.join(",")).order("id").range(desde, desde + PAG - 1);
    if (error) throw new Error(error.message);
    const lote = (data ?? []) as unknown as Record<string, unknown>[];
    for (const r of lote) {
      const o: Record<string, unknown> = {};
      for (const [c, titulo] of def.cols) {
        o[titulo] = c === "marca" ? n.marca(r.marca_id as number) : c === "sede" ? (r.sede_id ? n.sede(r.sede_id as number) : "")
          : c === "es_propina" ? (r[c] ? "Sí" : "No")
          // Para volver a subir, la fecha va como fecha de Excel (se lee igual que en el archivo original)
          : c === "fecha" && paraSubir && typeof r[c] === "string" ? (() => { const [y, m, d] = (r[c] as string).split("-").map(Number); return new Date(y, m - 1, d); })()
          : r[c] ?? null;
      }
      filas.push(o);
    }
    progreso?.(filas.length);
    if (lote.length < PAG) break;
  }
  return filas;
}

const nombreArchivo = (base: string) => base.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "_").replace(/^_|_$/g, "").toLowerCase();

/** Guarda las hojas en un Excel (una hoja por tabla) o, si es CSV, un archivo por tabla */
export async function guardar(hojas: { nombre: string; filas: Record<string, unknown>[] }[], base: string, formato: "xlsx" | "csv") {
  const XLSX = await import("xlsx");
  if (formato === "csv") {
    for (const h of hojas) {
      const ws = XLSX.utils.json_to_sheet(h.filas);
      const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
      const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url; a.download = `${nombreArchivo(`${base}_${h.nombre}`)}.csv`; a.click();
      URL.revokeObjectURL(url);
    }
    return;
  }
  const wb = XLSX.utils.book_new();
  for (const h of hojas) {
    const ws = XLSX.utils.json_to_sheet(h.filas.length ? h.filas : [{ Aviso: "Sin datos para este filtro" }], { dateNF: "dd/mm/yyyy" });
    const cols = Object.keys(h.filas[0] ?? { Aviso: "" });
    ws["!cols"] = cols.map((c) => ({ wch: Math.min(40, Math.max(10, c.length + 2)) }));
    XLSX.utils.book_append_sheet(wb, ws, h.nombre.slice(0, 31));
  }
  XLSX.writeFile(wb, `${nombreArchivo(base)}.xlsx`, { compression: true });
}
