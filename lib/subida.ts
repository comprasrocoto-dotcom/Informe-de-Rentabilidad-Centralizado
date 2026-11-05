// Guarda en Supabase lo que leyó el importador. Dos modos:
//  · "agregar" (por defecto): SUMA lo nuevo a lo que hay. Solo se reemplazan los días exactos (por sede) que trae
//    el archivo, así subir otro mes, o la segunda quincena, no borra lo anterior, y volver a subir un día no lo duplica.
//    En la carta se agregan o actualizan los artículos del archivo y los demás quedan.
//  · "meses": reemplaza los meses completos (por sede) que toca el archivo. En la carta, la reemplaza completa.
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarSede, type ResultadoHoja } from "./importador";

const TABLA = {
  ventas: "ventas",
  compras: "compras",
  inventarios: "inventarios",
  traslados: "traslados",
  rentabilidad: "rentabilidad_items",
} as const;

export type ModoGuardado = "agregar" | "meses";

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
  const { data: existentes } = await sb.from("sedes").select("id,nombre").eq("marca_id", marcaId);
  const porNombre = new Map((existentes ?? []).map((x) => [normalizarSede(x.nombre as string), x.id as number]));
  for (const n of nombres.map(normalizarSede)) {
    if (mapa.has(n)) continue;
    // Si el archivo trae el nombre con que la sede ya existe (p. ej. una base descargada de la web), se reutiliza
    const yaExiste = porNombre.get(n);
    if (yaExiste) {
      const { error: ea } = await sb.from("sede_alias").insert({ marca_id: marcaId, alias: n, sede_id: yaExiste });
      if (ea) throw ea;
      mapa.set(n, yaExiste);
      continue;
    }
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
  modo: ModoGuardado = "agregar",
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

  // 1) Borrar lo anterior que este archivo reemplaza
  if (res.tipo === "rentabilidad" && modo === "meses") {
    progreso("Reemplazando la carta anterior…", 0.02);
    const { error } = await sb.from(tabla).delete().eq("marca_id", marcaId).neq("carga_id", cargaId);
    if (error) throw error;
    const { error: e2 } = await sb.from(tabla).delete().eq("marca_id", marcaId).is("carga_id", null);
    if (e2) throw e2;
  } else if (res.tipo === "rentabilidad") {
    // Agregar: se actualizan solo los artículos que trae el archivo
    const arts = [...new Set(res.filas.map((f) => (f as { articulo?: string }).articulo).filter((a): a is string => !!a))];
    for (let i = 0; i < arts.length; i += 150) {
      progreso("Actualizando artículos de la carta…", 0.02 + (0.08 * i) / Math.max(1, arts.length));
      const { error } = await sb.from(tabla).delete().eq("marca_id", marcaId).in("articulo", arts.slice(i, i + 150));
      if (error) throw error;
    }
  } else if (modo === "agregar") {
    // Días exactos por sede que trae el archivo
    const diasDe = (filas: { sede?: string; fecha?: string | null }[]) => {
      const m = new Map<number, Set<string>>();
      for (const f of filas) {
        const id = sedes.get(normalizarSede(f.sede ?? ""));
        if (!id || !f.fecha) continue;
        (m.get(id) ?? m.set(id, new Set()).get(id)!).add(f.fecha);
      }
      return m;
    };
    const borrarDias = async (t: string, dias: Map<number, Set<string>>, texto: string) => {
      const pares = [...dias.entries()];
      for (const [k, [sedeId, set]] of pares.entries()) {
        const lista = [...set].sort();
        for (let i = 0; i < lista.length; i += 60) {
          progreso(`${texto} (${lista[i].slice(0, 7)})…`, 0.02 + (0.08 * k) / Math.max(1, pares.length));
          const { error } = await sb.from(t).delete().eq("marca_id", marcaId).eq("sede_id", sedeId).in("fecha", lista.slice(i, i + 60));
          if (error) throw error;
        }
      }
    };
    await borrarDias(tabla, diasDe(res.filas as { sede?: string; fecha?: string }[]), "Reemplazando solo los días que trae el archivo");
    // Facturas: solo se reemplazan los días para los que el archivo trae facturas (si no trae número de
    // documento, se conservan las que había y no se pierde el ticket promedio)
    if (res.tipo === "ventas" && res.facturas?.length) await borrarDias("ventas_facturas", diasDe(res.facturas), "Reemplazando facturas de esos días");
  } else if (res.desde && res.hasta && sedeIds.length) {
    const ventanas = ventanasMensuales(res.desde, res.hasta);
    for (let i = 0; i < ventanas.length; i++) {
      const [a, b] = ventanas[i];
      progreso(`Reemplazando datos anteriores (${a.slice(0, 7)})…`, 0.02 + (0.08 * i) / ventanas.length);
      const { error } = await sb.from(tabla).delete().eq("marca_id", marcaId).in("sede_id", sedeIds).gte("fecha", a).lte("fecha", b);
      if (error) throw error;
      if (res.tipo === "ventas") {
        const { error: ef } = await sb.from("ventas_facturas").delete().eq("marca_id", marcaId).in("sede_id", sedeIds).gte("fecha", a).lte("fecha", b);
        if (ef) throw ef;
      }
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

  // Ventas: guardar facturas (para ticket promedio) y clasificar centro de costo como Casa de Nadie
  if (res.tipo === "ventas") {
    const fs = (res.facturas ?? []).map((x) => {
      const { sede, ...resto } = x;
      return { ...resto, marca_id: marcaId, carga_id: cargaId, sede_id: sedes.get(normalizarSede(sede)) };
    });
    for (let i = 0; i < fs.length; i += LOTE) {
      progreso(`Guardando facturas ${Math.min(i + LOTE, fs.length).toLocaleString("es-CO")} de ${fs.length.toLocaleString("es-CO")}…`, 0.97);
      const { error } = await sb.from("ventas_facturas").insert(fs.slice(i, i + LOTE));
      if (error) throw error;
    }
    progreso("Clasificando ventas por centro de costo…", 0.99);
    const { error: ec } = await sb.rpc("clasificar_ventas", { p_marca: marcaId });
    if (ec) throw ec;
  }

  await sb.from("cargas").update({ filas_guardadas: hechos }).eq("id", cargaId);
  progreso("Listo", 1);
  return { cargaId, guardadas: hechos };
}
