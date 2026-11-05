"use client";

import { useState } from "react";
import { useApp } from "./Contexto";
import { contar, guardar, PARA_SUBIR, TABLAS, traer, type FiltroBase, type TablaBase } from "@/lib/descargaBase";
import { fmtNum } from "@/lib/formato";

const OPCIONES: { v: TablaBase | "todo"; t: string }[] = [
  { v: "compras", t: "Compras" }, { v: "ventas", t: "Ventas (por día y artículo)" }, { v: "ventas_facturas", t: "Facturas de venta" },
  { v: "inventarios", t: "Inventarios" }, { v: "traslados", t: "Traslados" }, { v: "rentabilidad_items", t: "Rentabilidad de carta" },
  { v: "todo", t: "Todo (una hoja por tipo)" },
];
const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

/** Descarga de la base de datos: por tipo, marca, sede y fechas. Cada usuario solo baja sus marcas. */
export function DescargarBase() {
  const { sb, marcas, sedes, perfil } = useApp();
  const misMarcas = perfil.rol === "admin" ? marcas : marcas.filter((m) => perfil.marcas.includes(m.id));
  const [tabla, setTabla] = useState<TablaBase | "todo">("compras");
  const [marcaId, setMarcaId] = useState<number | null>(misMarcas.length === 1 ? misMarcas[0].id : null);
  const [sedeId, setSedeId] = useState<number | null>(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [formato, setFormato] = useState<"xlsx" | "csv" | "subir">("subir");
  const [estado, setEstado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sedesMarca = sedes.filter((s) => marcaId == null || s.marca_id === marcaId);

  async function descargar() {
    setError(null);
    const paraSubir = formato === "subir";
    if (paraSubir && tabla === "ventas_facturas") { setError("Las facturas no se suben solas: vienen dentro del archivo de ventas. Elige Ventas o el formato Excel."); return; }
    const tablas: TablaBase[] = (tabla === "todo" ? ["compras", "ventas", "ventas_facturas", "inventarios", "traslados", "rentabilidad_items"] as TablaBase[] : [tabla])
      .filter((t) => !paraSubir || PARA_SUBIR[t]);
    const f: FiltroBase = { marcaId, sedeId, desde, hasta };
    try {
      setEstado("Contando filas…");
      const totales = await Promise.all(tablas.map((t) => contar(sb, t, f)));
      const total = totales.reduce((a, n) => a + n, 0);
      if (!total) { setEstado(null); setError("No hay datos para ese filtro."); return; }
      if (formato === "xlsx" && Math.max(...totales) > 1_000_000) { setEstado(null); setError("Son más de 1.000.000 de filas: Excel no las abre. Elige CSV o un rango de fechas más corto."); return; }
      const nombres = { marca: (id: number) => marcas.find((m) => m.id === id)?.nombre ?? String(id), sede: (id: number) => sedes.find((s) => s.id === id)?.nombre ?? String(id) };
      const hojas: { nombre: string; filas: Record<string, unknown>[] }[] = [];
      let previas = 0;
      for (const [i, t] of tablas.entries()) {
        if (!totales[i] && tabla === "todo") continue;
        const filas = await traer(sb, t, f, nombres, (n) => setEstado(`Descargando ${TABLAS[t].nombre}: ${fmtNum(previas + n)} de ${fmtNum(total)} filas…`), paraSubir);
        previas += filas.length;
        hojas.push({ nombre: paraSubir ? PARA_SUBIR[t]!.hoja : TABLAS[t].hoja, filas });
      }
      setEstado("Armando el archivo…");
      const marca = marcaId ? marcas.find((m) => m.id === marcaId)?.nombre : "todas las marcas";
      await guardar(hojas, `${paraSubir ? "para_subir" : "base"}_${tabla === "todo" ? "completa" : TABLAS[tabla].hoja}_${marca}_${desde || "inicio"}_${hasta || hoy()}`, paraSubir ? "xlsx" : formato);
      setEstado(`Listo: ${fmtNum(previas)} filas descargadas.`);
    } catch (e) {
      setEstado(null);
      setError(`No se pudo descargar: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const ocupado = !!estado && !estado.startsWith("Listo");
  return (
    <div className="tarjeta mb-5 space-y-3">
      <div>
        <h2 className="text-sm font-medium">Descargar base de datos</h2>
        <p className="text-xs text-texto-2">
          Baja lo que hay guardado. Deja las fechas vacías para bajar todo. <b>Excel para volver a subir</b> trae las mismas columnas del archivo que subes
          (Almacén, Fecha, Artículo, Total Neto…): puedes agregarle filas nuevas y subirlo otra vez por “Cargar datos” sin cambiar nada.
          Las ventas están agrupadas por día y artículo (así se guardan) y sin número de factura: al volver a subirlas se conservan las facturas que ya había.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label><span className="etiqueta">Qué</span>
          <select className="campo w-60" value={tabla} onChange={(e) => setTabla(e.target.value as TablaBase | "todo")}>
            {OPCIONES.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select>
        </label>
        {misMarcas.length > 1 && (
          <label><span className="etiqueta">Marca</span>
            <select className="campo w-44" value={marcaId ?? ""} onChange={(e) => { setMarcaId(e.target.value ? Number(e.target.value) : null); setSedeId(null); }}>
              <option value="">Todas</option>
              {misMarcas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </label>
        )}
        <label><span className="etiqueta">Sede</span>
          <select className="campo w-52" value={sedeId ?? ""} onChange={(e) => setSedeId(e.target.value ? Number(e.target.value) : null)} disabled={tabla === "rentabilidad_items"}>
            <option value="">Todas</option>
            {sedesMarca.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </label>
        <label><span className="etiqueta">Desde</span><input type="date" className="campo" value={desde} onChange={(e) => setDesde(e.target.value)} disabled={tabla === "rentabilidad_items"} /></label>
        <label><span className="etiqueta">Hasta</span><input type="date" className="campo" value={hasta} onChange={(e) => setHasta(e.target.value)} disabled={tabla === "rentabilidad_items"} /></label>
        <label><span className="etiqueta">Formato</span>
          <select className="campo w-56" value={formato} onChange={(e) => setFormato(e.target.value as "xlsx" | "csv" | "subir")}>
            <option value="subir">Excel para volver a subir</option><option value="xlsx">Excel (con marca y nombres claros)</option><option value="csv">CSV (;)</option>
          </select>
        </label>
        <button className="boton" onClick={descargar} disabled={ocupado}>{ocupado ? "Descargando…" : "Descargar"}</button>
      </div>
      {estado && <p className={`text-sm ${estado.startsWith("Listo") ? "text-bien" : "text-texto-2"}`}>{estado}</p>}
      {error && <p className="text-sm text-alerta">{error}</p>}
    </div>
  );
}

/** Descarga exactamente las filas que entraron con una carga del historial */
export async function descargarCarga(
  sb: Parameters<typeof traer>[0], c: { id: number; tipo: string; archivo: string },
  nombres: Parameters<typeof traer>[3], progreso: (t: string) => void,
) {
  const mapa: Record<string, TablaBase[]> = { compras: ["compras"], ventas: ["ventas", "ventas_facturas"], inventarios: ["inventarios"], traslados: ["traslados"], rentabilidad: ["rentabilidad_items"] };
  const tablas = mapa[c.tipo] ?? [];
  const hojas = [];
  for (const t of tablas) {
    const filas = await traer(sb, t, { cargaId: c.id }, nombres, (n) => progreso(`${fmtNum(n)} filas…`));
    if (filas.length || t !== "ventas_facturas") hojas.push({ nombre: TABLAS[t].hoja, filas });
  }
  await guardar(hojas, `carga_${c.id}_${c.archivo.replace(/\.[^.]+$/, "")}`, "xlsx");
}
