// Guarda en Supabase lo que leyó el importador.
// Regla: al cargar una hoja se REEMPLAZAN los datos de esa marca, de esas sedes y de ese rango de fechas
// (así volver a subir el mismo mes corrige el informe en vez de duplicarlo).
// La rentabilidad de carta se reemplaza completa para la marca.
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarSede, type ResultadoHoja } from "./importador";

const TABLA = {
  ventas: "ventas",
  compras: "compras",
  inventarios: "inventarios",
  traslados: "traslados",
  rentabilidad: "rentabilidad_items",
} as const;

export type EstadoSede = { nombreArchivo: string; sedeId: number | null; sedeNombre: string | null };

/** Muestra con qué sede quedará cada nombre del archivo (sin crear nada). */
export async function revisarSedes(sb: SupabaseClient, marcaId: number, nombres: string[]): Promise<EstadoSede[]> {
  const [{ data: alias }, { data: sedes }] = await Promise.all([
    sb.from("sede_alias").select("alias,sede_id").eq("marca_id", marcaId),
    sb.from("sedes").select("id,nombre").eq("marca_id", marcaId),
  ]);
  const porAlias = new Map((alias ?? []).map((a) => [a.alias as string, a.sede_id as number]));
  const nombrePorId = new Map((sedes ?? []).map((s) => [s.id as number, s.nombre as string]));
  return nombres.map((n) => {
    const id = porAlias.get(normalizarSede(n)) ?? null;
    return { nombreArchivo: n, sedeId: id, sedeNombre: id ? nombrePorId.get(id) ?? null : null };
  });
}

async function asegurarSedes(sb: SupabaseClient, marcaId: number, nombres: string[]): Promise<Map<string, number>> {
  const { data: alias, error } = await sb.from("sede_alias").select("alias,sede_id").eq("marca_id", marcaId);
  if (error) throw error;
  const mapa = new Map((alias ?? []).map((a) => [a.alias as string, a.sede_id as number]));
  for (const n of nombres.map(normalizarSede)) {
    if (mapa.has(n)) continue;
    // Sede nueva: se crea con ese nombre y el administrador puede luego unirla a otra.
    const { error: e1 } = await sb.from("sedes").upsert({ marca_id: marcaId, nombre: n }, { onConflict: "marca_id,nombre", ignoreDuplicates: true });
    if (e1) throw e1;
    const { data: s, error: e2 } = await sb.from("sedes").select("id").eq("marca_id", marcaId).eq("nombre", n).single();
    if (e2) throw e2;
    const { error: e3 } = await sb.from("sede_alias").insert({ marca_id: marcaId, alias: n, sede_id: s.id });
    if (e3) throw e3;
    mapa.set(n, s.id);
  }
  return mapa;
}

function ventanasMensuales(desde: string, hasta: string): [string, string][] {
  const out: [string, string][] = [];
  let [y, m] = desde.split("-").map(Number);
  for (let guard = 0; guard < 240; guard++) {
    const ini = `${y}-${String(m).padStart(2, "0")}-01`;
    const finMes = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    out.push([ini < desde ? desde : ini, finMes > hasta ? hasta : finMes]);
    if (finMes >= hasta) break;
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

export async function guardarHoja(
  sb: SupabaseClient,
  marcaId: number,
  archivo: string,
  res: ResultadoHoja,
  progreso: (texto: string, fraccion: number) => void,
): Promise<{ cargaId: number; guardadas: number }> {
  const tabla = TABLA[res.tipo];
  progreso("Preparando sedes…", 0);
  const sedes = res.tipo === "rentabilidad" ? new Map<string, number>() : await asegurarSedes(sb, marcaId, res.sedes);
  const sedeIds = [...new Set(res.sedes.map((n) => sedes.get(normalizarSede(n))!))];

  const { data: carga, error: eC } = await sb.from("cargas").insert({
    marca_id: marcaId, archivo, hoja: res.hoja, tipo: res.tipo,
    // filas_leidas = filas que se deben guardar (sirve para detectar cargas incompletas)
    filas_leidas: res.filas.length, desde: res.desde, hasta: res.hasta,
  }).select("id").single();
  if (eC) throw eC;
  const cargaId = carga.id as number;

  // 1) Borrar lo anterior del mismo período
  if (res.tipo === "rentabilidad") {
    progreso("Reemplazando la carta anterior…", 0.02);
    const { error } = await sb.from(tabla).delete().eq("marca_id", marcaId).neq("carga_id", cargaId);
    if (error) throw error;
    const { error: e2 } = await sb.from(tabla).delete().eq("marca_id", marcaId).is("carga_id", null);
    if (e2) throw e2;
  } else if (res.desde && res.hasta && sedeIds.length) {
    const ventanas = ventanasMensuales(res.desde, res.hasta);
    for (let i = 0; i < ventanas.length; i++) {
      const [a, b] = ventanas[i];
      progreso(`Reemplazando datos anteriores (${a.slice(0, 7)})…`, 0.02 + (0.08 * i) / ventanas.length);
      const { error } = await sb.from(tabla).delete().eq("marca_id", marcaId).in("sede_id", sedeIds).gte("fecha", a).lte("fecha", b);
      if (error) throw error;
    }
  }

  // 2) Insertar en lotes
  const filas = res.filas.map((f) => {
    const { sede, ...resto } = f as { sede?: string } & Record<string, unknown>;
    const fila: Record<string, unknown> = { ...resto, marca_id: marcaId, carga_id: cargaId };
    if (res.tipo !== "rentabilidad") fila.sede_id = sedes.get(normalizarSede(sede));
    return fila;
  });
  const LOTE = 1000;
  const lotes: Record<string, unknown>[][] = [];
  for (let i = 0; i < filas.length; i += LOTE) lotes.push(filas.slice(i, i + LOTE));
  let hechos = 0;
  let siguiente = 0;
  async function trabajador() {
    while (siguiente < lotes.length) {
      const lote = lotes[siguiente++];
      let intento = 0;
      for (;;) {
        const { error } = await sb.from(tabla).insert(lote);
        if (!error) break;
        if (++intento >= 3) throw error;
        await new Promise((r) => setTimeout(r, 1500 * intento));
      }
      hechos += lote.length;
      progreso(`Guardando ${hechos.toLocaleString("es-CO")} de ${filas.length.toLocaleString("es-CO")} filas…`, 0.1 + 0.9 * (hechos / Math.max(1, filas.length)));
    }
  }
  await Promise.all([trabajador(), trabajador(), trabajador()]);

  await sb.from("cargas").update({ filas_guardadas: hechos }).eq("id", cargaId);
  progreso("Listo", 1);
  return { cargaId, guardadas: hechos };
}
