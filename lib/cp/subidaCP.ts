// Guarda el archivo de cierre CP. Cada hoja REEMPLAZA los meses que trae (así volver a subir un mes lo corrige).
// Base_Conversion se reemplaza completa. Costos compartidos reemplaza los meses que trae.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HojaCP } from "./importadorCP";

const TABLA: Record<HojaCP["tipo"], string> = {
  compras: "cp_compras", fabricaciones: "cp_fabricaciones", traslados: "cp_traslados",
  inventarios: "cp_inventarios", base_conversion: "cp_base_conversion", costos: "cp_costos_compartidos",
};

const finDeMes = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

export async function guardarHojaCP(sb: SupabaseClient, archivo: string, h: HojaCP, progreso: (t: string, f: number) => void) {
  const tabla = TABLA[h.tipo];
  const { data: carga, error: eC } = await sb.from("cp_cargas").insert({
    archivo, hoja: h.hoja, tipo: h.tipo, filas_leidas: h.filas.length, descartadas: h.descartadas, duplicadas: h.duplicadas,
    desde: h.desde, hasta: h.hasta,
  }).select("id").single();
  if (eC) throw eC;
  const cargaId = carga.id as number;

  progreso("Reemplazando lo anterior…", 0.05);
  if (h.tipo === "base_conversion") {
    const { error } = await sb.from(tabla).delete().neq("id", -1);
    if (error) throw error;
  } else if (h.tipo === "costos") {
    const meses = [...new Set(h.filas.map((f) => f.mes as string))];
    if (meses.length) {
      const { error } = await sb.from(tabla).delete().in("mes", meses);
      if (error) throw error;
    }
  } else if (h.desde && h.hasta) {
    const { error } = await sb.from(tabla).delete().gte("fecha", `${h.desde.slice(0, 7)}-01`).lte("fecha", finDeMes(h.hasta));
    if (error) throw error;
  }

  const filas = h.filas.map((f) => ({ ...f, carga_id: cargaId }));
  let hechos = 0;
  for (let i = 0; i < filas.length; i += 1000) {
    const { error } = await sb.from(tabla).insert(filas.slice(i, i + 1000));
    if (error) throw error;
    hechos += Math.min(1000, filas.length - i);
    progreso(`Guardando ${hechos.toLocaleString("es-CO")} de ${filas.length.toLocaleString("es-CO")}…`, 0.1 + 0.9 * (hechos / Math.max(1, filas.length)));
  }
  await sb.from("cp_cargas").update({ filas_guardadas: hechos }).eq("id", cargaId);
  return hechos;
}

/** Trae todas las filas de una tabla CP (de a 1000) */
export async function traerTodo<T>(sb: SupabaseClient, tabla: string, columnas = "*"): Promise<T[]> {
  const out: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await sb.from(tabla).select(columnas).order("id").range(desde, desde + 999);
    if (error) throw error;
    out.push(...((data as T[]) ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}
