"use client";

import { useEffect, useState } from "react";
import { Encabezado } from "@/components/Encabezado";
import { useApp } from "@/components/Contexto";
import { useCP } from "@/components/cp/ContextoCP";
import { NavCP } from "@/components/cp/NavCP";
import { Aviso, Seccion } from "@/components/cp/Comunes";
import { fmtFecha, fmtNum } from "@/lib/formato";
import { leerArchivoCP, type HojaCP, type MarcaCP, type TipoCP } from "@/lib/cp/importadorCP";
import { guardarHojaCP, type ModoCP } from "@/lib/cp/subidaCP";

const NOMBRE: Record<HojaCP["tipo"], string> = {
  compras: "Compras", fabricaciones: "Fabricación", traslados: "Traslados", inventarios: "Inventario final",
  base_conversion: "Base de conversión", costos: "Costos compartidos",
};
const TABLA: Record<HojaCP["tipo"], string> = {
  compras: "cp_compras", fabricaciones: "cp_fabricaciones", traslados: "cp_traslados",
  inventarios: "cp_inventarios", base_conversion: "cp_base_conversion", costos: "cp_costos_compartidos",
};
// Qué se sube: el libro de cierre completo o un archivo independiente de un solo tipo
type Eleccion = "libro" | TipoCP;
const OPCIONES: { v: Eleccion; t: string; ayuda: string }[] = [
  { v: "libro", t: "Libro de cierre completo", ayuda: "Excel con varias hojas: Compras, Fabricaciones, Traslados_Sedes, Inventario_CP, Base_Conversion y Costos_Compartidos_CP. Cada hoja se reconoce por su nombre." },
  { v: "compras", t: "Compras", ayuda: "Columnas: Fecha, Almacén, Serie / Número, Tipo Documento, Nif, Proveedor, Familia, Centro de costos, Artículo, Subartículo, Uds.C, Valor Unitario Con Impuesto, Total Neto. Solo se guardan los almacenes CENTRO DE PRODUCCION (San Agustín) y PLANTA PRODUCCIÓN ROCOTO (Rocoto)." },
  { v: "fabricaciones", t: "Fabricación", ayuda: "Columnas: Marca (o Almacén), Fecha Doc, Serie / Número, Familia, Cód. Barras, Artifabri, Artinsumo, Subartículo, Variación Stock, Coste Unitario, Coste Variación." },
  { v: "traslados", t: "Traslados", ayuda: "La marca sale de la columna Marca o, si no está, de la sede que recibe (sedes ROCOTO → Rocoto, sedes 123 WOK → San Agustín). Columnas: Marca, Fecha Doc, Serie / Número, Almacén, Almacén Destino, Familia, Artículo, Subartículo, Tipo Documento, Motivo Traspaso, Variación Stock, Coste, Coste Variación." },
  { v: "inventarios", t: "Inventario final", ayuda: "Columnas: Marca (o Almacén), Fecha Doc, Serie / Número, Almacén, Familia, Categoría, Artículo, Unidad, Coste Línea, Stock a Fecha, Variación Stock, Stock Inventario, Total." },
  { v: "base_conversion", t: "Base de conversión", ayuda: "Columnas: Codigo, Articulo, Unidad (Gramos o Und), Unidad de Conversion." },
  { v: "costos", t: "Costos compartidos", ayuda: "Columnas: Mes (2026-08 o una fecha), Concepto, Valor." },
];

type Carga = { id: number; archivo: string; hoja: string; tipo: HojaCP["tipo"]; filas_leidas: number; filas_guardadas: number | null; desde: string | null; hasta: string | null; created_at: string };

export default function CargarCP() {
  const { sb, perfil } = useApp();
  const { recargar } = useCP();
  const [archivo, setArchivo] = useState<string>("");
  const [hojas, setHojas] = useState<HojaCP[]>([]);
  const [ignoradas, setIgnoradas] = useState<string[]>([]);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [leyendo, setLeyendo] = useState(false);
  const [estado, setEstado] = useState<{ texto: string; f: number } | null>(null);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [historial, setHistorial] = useState<Carga[]>([]);
  const [eleccion, setEleccion] = useState<Eleccion>("libro");
  const [marcaForzada, setMarcaForzada] = useState<MarcaCP | "">("");
  const [modo, setModo] = useState<ModoCP>("agregar");

  const cargarHistorial = async () => {
    const { data } = await sb.from("cp_cargas").select("*").order("id", { ascending: false }).limit(100);
    setHistorial((data as Carga[]) ?? []);
  };
  useEffect(() => { cargarHistorial(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const leer = async (f: File | undefined) => {
    if (!f) return;
    setLeyendo(true); setMensaje(null); setHojas([]);
    try {
      const r = leerArchivoCP(await f.arrayBuffer(), f.name, { tipoForzado: eleccion === "libro" ? null : eleccion, marcaForzada: marcaForzada || null });
      setArchivo(f.name); setHojas(r.hojas); setIgnoradas(r.ignoradas);
      setElegidas(new Set(r.hojas.filter((h) => h.filas.length).map((h) => h.hoja)));
      if (!r.hojas.length) setMensaje({ ok: false, texto: eleccion === "libro"
        ? "No encontré hojas del cierre CP (Compras, Fabricación, Traslados, Inv Final, Base_Conversion, Costos compartidos). Si es un archivo de un solo tipo, elígelo arriba."
        : "No pude leer datos de ese archivo." });
      else if (r.hojas.every((h) => !h.filas.length)) setMensaje({ ok: false, texto: "El archivo no trae filas válidas. Revisa que tenga las columnas indicadas y, si no trae la marca ni el almacén del CP, elige la marca arriba." });
    } catch (e) {
      setMensaje({ ok: false, texto: `No pude leer el archivo: ${e instanceof Error ? e.message : String(e)}` });
    } finally { setLeyendo(false); }
  };

  const guardar = async () => {
    const lista = hojas.filter((h) => elegidas.has(h.hoja));
    let total = 0;
    try {
      for (const [i, h] of lista.entries()) {
        total += await guardarHojaCP(sb, archivo, h, (t, f) => setEstado({ texto: `${NOMBRE[h.tipo]} (${i + 1}/${lista.length}): ${t}`, f: (i + f) / lista.length }), modo);
      }
      setMensaje({ ok: true, texto: `Listo: ${fmtNum(total)} filas guardadas en ${lista.length} hojas.` });
      setHojas([]);
      await Promise.all([recargar(), cargarHistorial()]);
    } catch (e) {
      setMensaje({ ok: false, texto: `Error al guardar: ${(e as { message?: string })?.message ?? String(e)}` });
      cargarHistorial();
    } finally { setEstado(null); }
  };

  const borrar = async (c: Carga) => {
    if (!window.confirm(`¿Borrar la carga "${c.hoja}" de ${c.archivo}? Se eliminan sus ${fmtNum(c.filas_guardadas ?? 0)} filas.`)) return;
    const { error } = await sb.from(TABLA[c.tipo]).delete().eq("carga_id", c.id);
    if (!error) await sb.from("cp_cargas").delete().eq("id", c.id);
    setMensaje(error ? { ok: false, texto: error.message } : { ok: true, texto: "Carga borrada." });
    await Promise.all([recargar(), cargarHistorial()]);
  };

  if (perfil.rol !== "admin") return <p className="text-sm text-texto-2">Solo el administrador puede subir o borrar datos del Centro de producción.</p>;
  return (
    <div>
      <Encabezado titulo="Cargar cierre del CP" descripcion="Sube el libro de cierre completo o cada archivo por separado. Por defecto lo nuevo se suma a lo que ya hay: solo se reemplazan los días que trae el archivo, así que volver a subir un día no lo duplica." />
      <NavCP sinFiltros />
      <Seccion titulo="1. ¿Qué vas a subir?" nota="Puedes subir el libro de cierre completo o cada archivo por separado, en Excel o archivo plano (.csv / .txt)">
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            {OPCIONES.map((o) => (
              <button key={o.v} type="button" disabled={leyendo || !!estado}
                onClick={() => { setEleccion(o.v); setHojas([]); setMensaje(null); }}
                className={`rounded-lg border px-3 py-2 text-sm ${eleccion === o.v ? "border-marca bg-marca-suave font-medium text-tinta" : "border-linea bg-white hover:bg-fondo"}`}>{o.t}</button>
            ))}
          </div>
          <p className="rounded-md bg-fondo p-3 text-xs text-texto-2">{OPCIONES.find((o) => o.v === eleccion)!.ayuda}</p>

          <div className="flex flex-wrap items-start gap-4">
            {["fabricaciones", "traslados", "inventarios"].includes(eleccion) && (
              <label><span className="etiqueta">Marca del archivo</span>
                <select className="campo w-60" value={marcaForzada} onChange={(e) => { setMarcaForzada(e.target.value as MarcaCP | ""); setHojas([]); }}>
                  <option value="">Detectar automáticamente</option>
                  <option value="San Agustín">San Agustín</option>
                  <option value="Rocoto">Rocoto</option>
                </select>
                <span className="mt-1 block max-w-60 text-[11px] text-texto-3">Se detecta por la columna Marca o el almacén. Lo que elijas aquí se usa solo en filas donde no se pueda detectar.</span>
              </label>
            )}
            <div className="min-w-[18rem] flex-1">
              <span className="etiqueta">Cómo guardar</span>
              <div className="grid gap-2 md:grid-cols-2" role="radiogroup" aria-label="Cómo guardar">
                {([
                  ["agregar", "Agregar a lo que hay (recomendado)", eleccion === "base_conversion"
                    ? "Agrega o actualiza los códigos del archivo; los demás se conservan."
                    : eleccion === "costos" ? "Agrega o actualiza los conceptos de esos meses; los demás se conservan."
                    : "Suma lo nuevo. Solo se reemplazan los días exactos (por marca) que trae el archivo; los otros días y meses quedan."],
                  ["meses", eleccion === "base_conversion" ? "Reemplazar toda la base" : "Reemplazar meses completos", eleccion === "base_conversion"
                    ? "Borra toda la base de conversión y deja solo la del archivo."
                    : eleccion === "costos" ? "Borra los costos de los meses que trae el archivo y deja solo los del archivo."
                    : "Borra los meses completos que toca el archivo (de las marcas que trae) y deja solo lo del archivo."],
                ] as [ModoCP, string, string][]).map(([v, t, d]) => (
                  <label key={v} className={`flex cursor-pointer gap-2 rounded-lg border p-3 text-sm ${modo === v ? "border-marca bg-marca-suave" : "border-linea bg-white hover:bg-fondo"}`}>
                    <input type="radio" name="modoCP" className="mt-0.5" checked={modo === v} disabled={!!estado} onChange={() => setModo(v)} />
                    <span><b className="block font-medium">{t}</b><span className="text-xs text-texto-2">{d}</span></span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <label className="block"><span className="etiqueta">2. Archivo {eleccion === "libro" ? "Excel" : "Excel o plano (.csv / .txt)"}</span>
            <input type="file" accept={eleccion === "libro" ? ".xlsx,.xls,.xlsm" : ".xlsx,.xls,.xlsm,.csv,.txt,.tsv"} disabled={leyendo || !!estado} onChange={(e) => { leer(e.target.files?.[0]); e.target.value = ""; }} className="text-sm file:mr-3 file:rounded-sm file:border-0 file:bg-marca file:px-3 file:py-1.5 file:text-white" />
          </label>
          {leyendo && <p className="text-sm text-texto-2">Leyendo…</p>}
          {mensaje && <p className={`text-sm ${mensaje.ok ? "text-bien" : "text-alerta"}`}>{mensaje.texto}</p>}
        </div>
      </Seccion>

      {hojas.length > 0 && (
        <Seccion titulo={`3. Revisa lo que se va a guardar · ${archivo}`} accion={<button className="boton" disabled={!!estado || !elegidas.size} onClick={guardar}>Guardar {elegidas.size} hojas</button>}>
          <table className="tabla">
            <thead><tr><th className="w-8"></th><th>Hoja</th><th>Tipo</th><th className="num">Filas a guardar</th><th className="num">Descartadas</th><th className="num">Duplicadas</th><th>Periodo</th></tr></thead>
            <tbody>
              {hojas.map((h) => (
                <tr key={h.hoja}>
                  <td><input type="checkbox" checked={elegidas.has(h.hoja)} disabled={!h.filas.length} onChange={(e) => setElegidas((s) => { const n = new Set(s); if (e.target.checked) n.add(h.hoja); else n.delete(h.hoja); return n; })} /></td>
                  <td className="font-medium">{h.hoja}</td><td>{NOMBRE[h.tipo]}</td>
                  <td className="num">{fmtNum(h.filas.length)}</td><td className="num text-texto-2">{fmtNum(h.descartadas)}</td><td className="num text-texto-2">{h.tipo === "compras" ? fmtNum(h.duplicadas) : "—"}</td>
                  <td>{h.tipo === "base_conversion" ? (modo === "meses" ? "Reemplaza toda la base" : "Agrega o actualiza códigos") : h.desde ? `${fmtFecha(h.desde)} – ${fmtFecha(h.hasta)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {ignoradas.length > 0 && <p className="px-4 py-2 text-xs text-texto-3">Hojas ignoradas: {ignoradas.join(", ")}</p>}
          {estado && (
            <div className="px-4 py-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-marca-suave"><div className="h-full bg-marca transition-all" style={{ width: `${Math.round(estado.f * 100)}%` }} /></div>
              <p className="mt-1 text-xs text-texto-2">{estado.texto}</p>
            </div>
          )}
          <div className="px-4 pb-4"><Aviso>Compras: solo se guardan los almacenes del CP y la Planta, sin duplicados. Descartadas = filas de otros almacenes o sin datos.</Aviso></div>
        </Seccion>
      )}

      <Seccion titulo="Historial de cargas" nota="Si subiste algo por error, bórralo aquí">
        <table className="tabla">
          <thead><tr><th>Fecha</th><th>Archivo</th><th>Hoja</th><th>Tipo</th><th>Periodo</th><th className="num">Filas</th><th></th></tr></thead>
          <tbody>
            {historial.map((c) => (
              <tr key={c.id}>
                <td>{new Date(c.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}</td>
                <td className="max-w-[14rem] truncate" title={c.archivo}>{c.archivo}</td><td>{c.hoja}</td><td>{NOMBRE[c.tipo] ?? c.tipo}</td>
                <td>{c.desde ? `${fmtFecha(c.desde)} – ${fmtFecha(c.hasta)}` : "—"}</td>
                <td className="num">{fmtNum(c.filas_guardadas ?? 0)}</td>
                <td><button className="text-xs text-alerta hover:underline" onClick={() => borrar(c)}>Borrar</button></td>
              </tr>
            ))}
            {!historial.length && <tr><td colSpan={7} className="text-texto-3">Aún no hay cargas del CP.</td></tr>}
          </tbody>
        </table>
      </Seccion>
    </div>
  );
}
