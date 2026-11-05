"use client";

import { useEffect, useState } from "react";
import { Encabezado } from "@/components/Encabezado";
import { useApp } from "@/components/Contexto";
import { useCP } from "@/components/cp/ContextoCP";
import { NavCP } from "@/components/cp/NavCP";
import { Aviso, Seccion } from "@/components/cp/Comunes";
import { fmtFecha, fmtNum } from "@/lib/formato";
import { leerArchivoCP, type HojaCP } from "@/lib/cp/importadorCP";
import { guardarHojaCP } from "@/lib/cp/subidaCP";

const NOMBRE: Record<HojaCP["tipo"], string> = {
  compras: "Compras", fabricaciones: "Fabricación", traslados: "Traslados", inventarios: "Inventario final",
  base_conversion: "Base de conversión", costos: "Costos compartidos",
};
const TABLA: Record<HojaCP["tipo"], string> = {
  compras: "cp_compras", fabricaciones: "cp_fabricaciones", traslados: "cp_traslados",
  inventarios: "cp_inventarios", base_conversion: "cp_base_conversion", costos: "cp_costos_compartidos",
};
type Carga = { id: number; archivo: string; hoja: string; tipo: HojaCP["tipo"]; filas_leidas: number; filas_guardadas: number | null; desde: string | null; hasta: string | null; created_at: string };

export default function CargarCP() {
  const { sb } = useApp();
  const { recargar } = useCP();
  const [archivo, setArchivo] = useState<string>("");
  const [hojas, setHojas] = useState<HojaCP[]>([]);
  const [ignoradas, setIgnoradas] = useState<string[]>([]);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [leyendo, setLeyendo] = useState(false);
  const [estado, setEstado] = useState<{ texto: string; f: number } | null>(null);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [historial, setHistorial] = useState<Carga[]>([]);

  const cargarHistorial = async () => {
    const { data } = await sb.from("cp_cargas").select("*").order("id", { ascending: false }).limit(100);
    setHistorial((data as Carga[]) ?? []);
  };
  useEffect(() => { cargarHistorial(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const leer = async (f: File | undefined) => {
    if (!f) return;
    setLeyendo(true); setMensaje(null); setHojas([]);
    try {
      const r = leerArchivoCP(await f.arrayBuffer());
      setArchivo(f.name); setHojas(r.hojas); setIgnoradas(r.ignoradas);
      setElegidas(new Set(r.hojas.filter((h) => h.filas.length).map((h) => h.hoja)));
      if (!r.hojas.length) setMensaje({ ok: false, texto: "No encontré hojas del cierre CP (Compras, Fabricación, Traslados, Inv Final, Base_Conversion, Costos compartidos)." });
    } catch (e) {
      setMensaje({ ok: false, texto: `No pude leer el archivo: ${e instanceof Error ? e.message : String(e)}` });
    } finally { setLeyendo(false); }
  };

  const guardar = async () => {
    const lista = hojas.filter((h) => elegidas.has(h.hoja));
    let total = 0;
    try {
      for (const [i, h] of lista.entries()) {
        total += await guardarHojaCP(sb, archivo, h, (t, f) => setEstado({ texto: `${NOMBRE[h.tipo]} (${i + 1}/${lista.length}): ${t}`, f: (i + f) / lista.length }));
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

  return (
    <div>
      <Encabezado titulo="Cargar cierre del CP" descripcion="Sube el Excel de cierre de mes (Base de datos CP). Cada hoja reemplaza los meses que trae, así que volver a subir un mes lo corrige sin duplicar." />
      <NavCP sinFiltros />
      <Seccion titulo="1. Elige el archivo" nota="Hojas reconocidas: Compras, Fabricación, Traslados, Inv Final (Inventario_CP), Base_Conversion y Costos compartidos (Mes | Concepto | Valor)">
        <div className="p-4">
          <input type="file" accept=".xlsx,.xls,.xlsm,.csv" disabled={leyendo || !!estado} onChange={(e) => { leer(e.target.files?.[0]); e.target.value = ""; }} className="text-sm file:mr-3 file:rounded-sm file:border-0 file:bg-marca file:px-3 file:py-1.5 file:text-white" />
          {leyendo && <p className="mt-2 text-sm text-texto-2">Leyendo…</p>}
          {mensaje && <p className={`mt-3 text-sm ${mensaje.ok ? "text-bien" : "text-alerta"}`}>{mensaje.texto}</p>}
        </div>
      </Seccion>

      {hojas.length > 0 && (
        <Seccion titulo={`2. Revisa lo que se va a guardar · ${archivo}`} accion={<button className="boton" disabled={!!estado || !elegidas.size} onClick={guardar}>Guardar {elegidas.size} hojas</button>}>
          <table className="tabla">
            <thead><tr><th className="w-8"></th><th>Hoja</th><th>Tipo</th><th className="num">Filas a guardar</th><th className="num">Descartadas</th><th className="num">Duplicadas</th><th>Periodo</th></tr></thead>
            <tbody>
              {hojas.map((h) => (
                <tr key={h.hoja}>
                  <td><input type="checkbox" checked={elegidas.has(h.hoja)} disabled={!h.filas.length} onChange={(e) => setElegidas((s) => { const n = new Set(s); if (e.target.checked) n.add(h.hoja); else n.delete(h.hoja); return n; })} /></td>
                  <td className="font-medium">{h.hoja}</td><td>{NOMBRE[h.tipo]}</td>
                  <td className="num">{fmtNum(h.filas.length)}</td><td className="num text-texto-2">{fmtNum(h.descartadas)}</td><td className="num text-texto-2">{h.tipo === "compras" ? fmtNum(h.duplicadas) : "—"}</td>
                  <td>{h.tipo === "base_conversion" ? "Reemplaza toda la base" : h.desde ? `${fmtFecha(h.desde)} – ${fmtFecha(h.hasta)}` : "—"}</td>
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
