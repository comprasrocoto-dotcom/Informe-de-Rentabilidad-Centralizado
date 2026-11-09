// "Base de datos de este módulo": baja en Excel las filas originales que alimentan la página actual,
// con los filtros de marca, sede y fechas (en el CP, todo lo cargado). Una hoja por tabla.
import type { SupabaseClient } from "@supabase/supabase-js";
import { guardar, TABLAS, traer, type FiltroBase, type TablaBase } from "./descargaBase";

type Col = [campo: string, titulo: string];
type TablaCP = "cp_compras" | "cp_fabricaciones" | "cp_traslados" | "cp_inventarios" | "cp_base_conversion" | "cp_costos_compartidos" | "cp_reparto_manual";
const CP: Record<TablaCP, { hoja: string; orden: string; cols: Col[] }> = {
  cp_compras: { hoja: "CP Compras", orden: "id", cols: [["marca", "Marca"], ["fecha", "Fecha"], ["almacen", "Almacén"], ["serie", "Serie / Número"], ["tipo_documento", "Tipo Documento"], ["nif", "Nif"], ["proveedor", "Proveedor"], ["familia", "Familia"], ["centro_costos", "Centro de costos"], ["articulo", "Artículo"], ["subarticulo", "Subartículo"], ["unidades", "Uds.C"], ["valor_unitario", "Valor Unitario Con Impuesto"], ["total", "Total Neto"]] },
  cp_fabricaciones: { hoja: "CP Fabricación", orden: "id", cols: [["marca", "Marca"], ["fecha", "Fecha Doc"], ["serie", "Serie / Número"], ["almacen", "Almacén"], ["familia", "Familia"], ["codigo", "Cód. Barras"], ["artifabri", "Artifabri"], ["artinsumo", "Artinsumo"], ["unidad", "Subartículo"], ["cantidad", "Variación Stock"], ["costo_unitario", "Coste Unitario"], ["costo", "Coste Variación"]] },
  cp_traslados: { hoja: "CP Traslados", orden: "id", cols: [["marca", "Marca"], ["fecha", "Fecha Doc"], ["serie", "Serie / Número"], ["sede_destino", "Almacén Destino"], ["familia", "Familia"], ["articulo", "Artículo"], ["unidad", "Subartículo"], ["tipo_documento", "Tipo Documento"], ["motivo", "Motivo Traspaso"], ["cantidad", "Variación Stock"], ["costo_unitario", "Coste"], ["costo", "Coste Variación"]] },
  cp_inventarios: { hoja: "CP Inventario", orden: "id", cols: [["marca", "Marca"], ["fecha", "Fecha Doc"], ["serie", "Serie / Número"], ["almacen", "Almacén"], ["familia", "Familia"], ["categoria", "Categoría"], ["articulo", "Artículo"], ["unidad", "Unidad"], ["costo_linea", "Coste Línea"], ["stock_fecha", "Stock a Fecha"], ["variacion", "Variación Stock"], ["stock_inventario", "Stock Inventario"], ["total", "Total"]] },
  cp_base_conversion: { hoja: "CP Base conversión", orden: "id", cols: [["codigo", "Codigo"], ["articulo", "Articulo"], ["unidad", "Unidad"], ["factor", "Unidad de Conversion"]] },
  cp_costos_compartidos: { hoja: "CP Costos compartidos", orden: "id", cols: [["mes", "Mes"], ["concepto", "Concepto"], ["valor", "Valor"]] },
  cp_reparto_manual: { hoja: "CP Reparto manual", orden: "mes", cols: [["mes", "Mes"], ["pct_san_agustin", "% San Agustín"], ["actualizado", "Actualizado"], ["actualizado_por", "Por"]] },
};
const TODO_CP = Object.keys(CP) as TablaCP[];

/** Qué tablas alimentan cada módulo (por ruta) */
export function tablasDeRuta(ruta: string): { nombre: string; tablas: (TablaBase | TablaCP)[] } {
  if (ruta.startsWith("/cp")) return { nombre: "Centro de producción", tablas: TODO_CP };
  const r = ruta.replace(/\/$/, "") || "/";
  const M: Record<string, { nombre: string; tablas: TablaBase[] }> = {
    "/": { nombre: "Resumen", tablas: ["ventas", "compras", "traslados", "inventarios"] },
    "/ventas": { nombre: "Ventas", tablas: ["ventas", "ventas_facturas"] },
    "/descuentos": { nombre: "Descuentos", tablas: ["ventas"] },
    "/compras": { nombre: "Compras", tablas: ["compras", "traslados"] },
    "/compras/cocina-bar": { nombre: "Compras Cocina y Bar", tablas: ["compras", "traslados"] },
    "/compras-ventas": { nombre: "Compras vs ventas", tablas: ["ventas", "compras", "traslados", "inventarios"] },
    "/traslados": { nombre: "Traslados", tablas: ["traslados"] },
    "/costo": { nombre: "Costo", tablas: ["ventas", "compras", "traslados", "inventarios"] },
    "/carta": { nombre: "Rentabilidad de carta", tablas: ["rentabilidad_items", "ventas"] },
    "/participacion": { nombre: "Participación", tablas: ["ventas", "compras", "traslados"] },
    "/inventarios": { nombre: "Inventarios", tablas: ["inventarios"] },
    "/mercancia": { nombre: "Mercancía vendida", tablas: ["ventas", "compras", "traslados", "inventarios"] },
  };
  return M[r] ?? { nombre: "Todas las bases", tablas: ["ventas", "ventas_facturas", "compras", "traslados", "inventarios", "rentabilidad_items"] };
}

async function traerCP(sb: SupabaseClient, t: TablaCP, progreso?: (n: number) => void) {
  const def = CP[t];
  const filas: Record<string, unknown>[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await sb.from(t).select(def.cols.map((c) => c[0]).join(",")).order(def.orden).range(desde, desde + 999);
    if (error) throw new Error(error.message);
    const lote = (data ?? []) as unknown as Record<string, unknown>[];
    lote.forEach((r) => filas.push(Object.fromEntries(def.cols.map(([c, titulo]) => [titulo, r[c] ?? null]))));
    progreso?.(filas.length);
    if (lote.length < 1000) break;
  }
  return filas;
}

export async function descargarModulo(
  sb: SupabaseClient, ruta: string, f: FiltroBase,
  nombres: { marca: (id: number) => string; sede: (id: number) => string; marcaFiltro: string },
  progreso: (texto: string) => void,
) {
  const { nombre, tablas } = tablasDeRuta(ruta);
  const hojas: { nombre: string; filas: Record<string, unknown>[] }[] = [];
  let acumulado = 0;
  for (const t of tablas) {
    if (t in CP) {
      const def = CP[t as TablaCP];
      const filas = await traerCP(sb, t as TablaCP, (n) => progreso(`${def.hoja}: ${(acumulado + n).toLocaleString("es-CO")} filas…`));
      acumulado += filas.length;
      hojas.push({ nombre: def.hoja, filas });
    } else {
      const def = TABLAS[t as TablaBase];
      const filas = await traer(sb, t as TablaBase, f, nombres, (n) => progreso(`${def.hoja}: ${(acumulado + n).toLocaleString("es-CO")} filas…`));
      acumulado += filas.length;
      hojas.push({ nombre: def.hoja, filas });
    }
  }
  progreso("Armando el Excel…");
  const rango = ruta.startsWith("/cp") ? "todo" : `${f.desde || "inicio"}_${f.hasta || "hoy"}`;
  await guardar(hojas, `base_${nombre}_${ruta.startsWith("/cp") ? "CP" : nombres.marcaFiltro}_${rango}`, "xlsx");
  return acumulado;
}
