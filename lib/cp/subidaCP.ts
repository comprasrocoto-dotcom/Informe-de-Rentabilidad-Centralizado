// Guarda lo leído del CP. Dos modos:
//  · "agregar" (por defecto): SUMA a lo que hay. Solo se reemplazan los días exactos, por marca, que trae el archivo
//    (volver a subir un día no lo duplica). En Base de conversión se agregan o actualizan los códigos del archivo y en
//    Costos compartidos los conceptos de esos meses; lo demás se conserva.
//  · "meses": reemplaza los meses completos que toca el archivo, solo de las marcas que trae. Base de conversión se
//    reemplaza completa y Costos compartidos reemplaza esos meses.
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

export type ModoCP = "agregar" | "meses";

export async function guardarHojaCP(sb: SupabaseClient, archivo: string, h: HojaCP, progreso: (t: string, f: number) => void, modo: ModoCP = "agregar") {
  const tabla = TABLA[h.tipo];
  const { data: carga, error: eC } = await sb.from("cp_cargas").insert({
    archivo, hoja: h.hoja, tipo: h.tipo, filas_leidas: h.filas.length, descartadas: h.descartadas, duplicadas: h.duplicadas,
    desde: h.desde, hasta: h.hasta,
  }).select("id").single();
  if (eC) throw eC;
  const cargaId = carga.id as number;

  progreso("Reemplazando lo anterior…", 0.05);
  const borrarEn = async (col: string, valores: unknown[], extra?: (q: ReturnType<ReturnType<SupabaseClient["from"]>["delete"]>) => typeof q) => {
    for (let i = 0; i < valores.length; i += 100) {
      let q = sb.from(tabla).delete().in(col, valores.slice(i, i + 100) as string[]);
      if (extra) q = extra(q);
      const { error } = await q;
      if (error) throw error;
    }
  };
  if (h.tipo === "base_conversion") {
    if (modo === "meses") {
      const { error } = await sb.from(tabla).delete().neq("id", -1);
      if (error) throw error;
    } else {
      // Agregar: se reemplazan los códigos (o, si no tienen código, los artículos) que trae el archivo
      await borrarEn("codigo", [...new Set(h.filas.map((f) => f.codigo).filter(Boolean))]);
      await borrarEn("articulo", [...new Set(h.filas.filter((f) => !f.codigo).map((f) => f.articulo).filter(Boolean))], (q) => q.is("codigo", null));
    }
  } else if (h.tipo === "costos") {
    const meses = [...new Set(h.filas.map((f) => f.mes as string))];
    if (modo === "meses") await borrarEn("mes", meses);
    else for (const m of meses) await borrarEn("concepto", [...new Set(h.filas.filter((f) => f.mes === m).map((f) => f.concepto))], (q) => q.eq("mes", m));
  } else {
    const marcas = [...new Set(h.filas.map((f) => f.marca as string))];
    for (const marca of marcas) {
      if (modo === "meses" && h.desde && h.hasta) {
        const { error } = await sb.from(tabla).delete().eq("marca", marca).gte("fecha", `${h.desde.slice(0, 7)}-01`).lte("fecha", finDeMes(h.hasta));
        if (error) throw error;
      } else {
        const dias = [...new Set(h.filas.filter((f) => f.marca === marca).map((f) => f.fecha as string))].sort();
        await borrarEn("fecha", dias, (q) => q.eq("marca", marca));
      }
    }
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
