"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/Contexto";
import { GUIA_COLUMNAS, type HojaDisponible, type ResultadoHoja, type TipoHoja } from "@/lib/importador";
import { guardarHoja, revisarSedes, type EstadoSede } from "@/lib/subida";
import { fmtNum } from "@/lib/formato";

type Lectura = { res?: ResultadoHoja; error?: string; sedes?: EstadoSede[] };
type Avance = { texto: string; fraccion: number; estado: "esperando" | "guardando" | "ok" | "error" };
type Carga = { id: number; marca_id: number; archivo: string; hoja: string; tipo: string; filas_leidas: number; filas_guardadas: number; desde: string | null; hasta: string | null; created_at: string };

const NOMBRE_TIPO: Record<TipoHoja, string> = {
  ventas: "Ventas", compras: "Compras", inventarios: "Inventarios", traslados: "Traslados", rentabilidad: "Rentabilidad de carta",
};
const ORDEN_TIPOS: TipoHoja[] = ["compras", "inventarios", "traslados", "ventas", "rentabilidad"];
type Eleccion = TipoHoja | "libro";

function descargarPlantilla(tipo: TipoHoja) {
  const g = GUIA_COLUMNAS[tipo];
  const contenido = "\uFEFF" + [...g.obligatorias, ...g.opcionales].join(";") + "\r\n";
  const url = URL.createObjectURL(new Blob([contenido], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `plantilla_${tipo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Cargar() {
  const { sb, perfil, marcas, recargarCatalogos, variasMarcas } = useApp();
  const [marcaId, setMarcaId] = useState<number | null>(perfil.rol !== "admin" && perfil.marcas.length === 1 ? perfil.marcas[0] : null);
  const [eleccion, setEleccion] = useState<Eleccion | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [separador, setSeparador] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [hojas, setHojas] = useState<HojaDisponible[]>([]);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [fechaRespaldo, setFechaRespaldo] = useState("");
  const [lecturas, setLecturas] = useState<Record<string, Lectura>>({});
  const [avances, setAvances] = useState<Record<string, Avance>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historial, setHistorial] = useState<Carga[]>([]);
  const [vigentes, setVigentes] = useState<Record<number, number>>({});
  const [borrando, setBorrando] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [mesHistorial, setMesHistorial] = useState("");
  const worker = useRef<Worker | null>(null);
  const pendientes = useRef(new Map<number, (v: { ok: boolean; error?: string; hojas?: HojaDisponible[]; res?: ResultadoHoja }) => void>());
  const contador = useRef(0);

  async function cargarHistorial() {
    let q = sb.from("cargas").select("*").order("created_at", { ascending: false }).limit(200);
    if (marcaId) q = q.eq("marca_id", marcaId);
    const { data } = await q;
    const lista = (data as Carga[]) ?? [];
    setHistorial(lista);
    if (lista.length) {
      const { data: f } = await sb.rpc("filas_por_carga", { p_ids: lista.map((c) => c.id) });
      setVigentes(Object.fromEntries(((f as { carga_id: number; filas: number }[]) ?? []).map((x) => [x.carga_id, Number(x.filas)])));
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargarHistorial(); }, [marcaId]);

  useEffect(() => () => worker.current?.terminate(), []);

  function pedir<T>(msg: Record<string, unknown>, transferir?: Transferable[]): Promise<T> {
    if (!worker.current) {
      worker.current = new Worker(new URL("../../../lib/lector.worker.ts", import.meta.url), { type: "module" });
      worker.current.onmessage = (e) => {
        const r = pendientes.current.get(e.data.id);
        pendientes.current.delete(e.data.id);
        r?.(e.data);
      };
    }
    const id = ++contador.current;
    return new Promise<T>((resolve, reject) => {
      pendientes.current.set(id, (v) => (v.ok ? resolve(v as T) : reject(new Error(v.error))));
      worker.current!.postMessage({ ...msg, id }, transferir ?? []);
    });
  }

  async function elegirArchivo(f: File | null) {
    setArchivo(f);
    setSeparador(null);
    setHojas([]);
    setLecturas({});
    setAvances({});
    setError(null);
    if (!f) return;
    setOcupado("Abriendo el archivo…");
    try {
      worker.current?.terminate();
      worker.current = null;
      const datos = await f.arrayBuffer();
      const r = await pedir<{ hojas: HojaDisponible[]; plano: { separador: string } | null }>({ cmd: "abrir", nombre: f.name, datos }, [datos]);
      setHojas(r.hojas);
      setSeparador(r.plano?.separador ?? null);
      if (eleccion === "libro") {
        setElegidas(new Set(r.hojas.filter((h) => h.tipo).map((h) => h.nombre)));
      } else {
        // Un solo tipo: se toma la hoja con ese nombre, o la primera
        const h = r.hojas.find((x) => x.tipo === eleccion) ?? r.hojas[0];
        setElegidas(new Set(h ? [h.nombre] : []));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(null);
    }
  }

  async function leer() {
    if (!marcaId) return setError("Elige la marca a la que pertenece el archivo.");
    setError(null);
    setAvances({});
    const nuevas: Record<string, Lectura> = {};
    for (const h of hojas.filter((x) => elegidas.has(x.nombre))) {
      setOcupado(`Leyendo hoja “${h.nombre}”…`);
      try {
        const { res } = await pedir<{ res: ResultadoHoja }>({
          cmd: "leer", hoja: h.nombre, op: { fechaRespaldo: fechaRespaldo || null },
          tipo: eleccion && eleccion !== "libro" ? eleccion : null,
        });
        const sedes = res.tipo === "rentabilidad" ? [] : await revisarSedes(sb, marcaId, res.sedes);
        nuevas[h.nombre] = { res, sedes };
      } catch (e) {
        nuevas[h.nombre] = { error: e instanceof Error ? e.message : String(e) };
      }
      setLecturas({ ...nuevas });
    }
    setOcupado(null);
  }

  async function guardar() {
    if (!marcaId || !archivo) return;
    const lista = Object.entries(lecturas).filter(([, l]) => l.res && l.res.filas.length > 0);
    const ini: Record<string, Avance> = {};
    lista.forEach(([h]) => (ini[h] = { texto: "En espera", fraccion: 0, estado: "esperando" }));
    setAvances(ini);
    setOcupado("Guardando en la base de datos… no cierres esta pestaña.");
    for (const [hoja, l] of lista) {
      try {
        await guardarHoja(sb, marcaId, archivo.name, l.res!, (texto, fraccion) =>
          setAvances((a) => ({ ...a, [hoja]: { texto, fraccion, estado: "guardando" } })),
        );
        setAvances((a) => ({ ...a, [hoja]: { texto: "Guardado", fraccion: 1, estado: "ok" } }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e);
        setAvances((a) => ({ ...a, [hoja]: { texto: `Error: ${msg}. Puedes volver a intentarlo: se reemplaza lo cargado.`, fraccion: 0, estado: "error" } }));
      }
    }
    setOcupado(null);
    await recargarCatalogos();
    await cargarHistorial();
  }

  async function borrarCarga(c: Carga) {
    const n = vigentes[c.id] ?? 0;
    const detalle = n > 0
      ? `Se borrarán ${n.toLocaleString("es-CO")} filas de ${NOMBRE_TIPO[c.tipo as TipoHoja] ?? c.tipo} de ${marcaNombre(c.marca_id)}` +
        (c.desde ? ` (${c.desde} a ${c.hasta})` : "") + ` que entraron con el archivo “${c.archivo}”.`
      : `Esta carga ya no tiene datos (fue reemplazada por una carga posterior). Solo se quitará del historial.`;
    if (!window.confirm(`${detalle}\n\nEsto no se puede deshacer. ¿Continuar?`)) return;
    setBorrando(c.id);
    setAviso(null);
    setError(null);
    const { data, error } = await sb.rpc("borrar_carga", { p_carga: c.id });
    setBorrando(null);
    if (error) return setError(`No se pudo borrar: ${error.message}`);
    setAviso(`Listo: se borraron ${Number(data ?? 0).toLocaleString("es-CO")} filas y la carga salió del historial.`);
    await cargarHistorial();
  }

  // Meses que cubre alguna carga (para el filtro del historial)
  const mesesHistorial = [...new Set(historial.flatMap((c) => {
    if (!c.desde || !c.hasta) return [];
    const out: string[] = [];
    let [y, m] = c.desde.slice(0, 7).split("-").map(Number);
    const fin = c.hasta.slice(0, 7);
    for (let i = 0; i < 120; i++) {
      const k = `${y}-${String(m).padStart(2, "0")}`;
      out.push(k);
      if (k >= fin) break;
      m++; if (m > 12) { m = 1; y++; }
    }
    return out;
  }))].sort().reverse();
  const historialFiltrado = mesHistorial
    ? historial.filter((c) => c.desde && c.hasta && c.desde.slice(0, 7) <= mesHistorial && c.hasta.slice(0, 7) >= mesHistorial)
    : historial;
  const NOMBRES_MES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const nombreMes = (k: string) => `${NOMBRES_MES[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;

  const hayLecturas = Object.values(lecturas).some((l) => l.res && l.res.filas.length > 0);
  const marcaNombre = (id: number) => marcas.find((m) => m.id === id)?.nombre ?? "";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-tinta">Cargar datos</h1>
        <p className="mt-1 max-w-3xl text-sm text-texto-2">
          Elige qué información vas a subir y luego el archivo: puede ser <b>archivo plano</b> (.csv o .txt, separado por punto y coma, coma o tabulación) o Excel.
          Al guardar se <b>reemplazan</b> los datos de las mismas sedes y fechas que trae el archivo, así que puedes volver a subir un mes para corregirlo sin duplicar.
        </p>
      </div>

      <div className="tarjeta space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          {variasMarcas ? (
            <label><span className="etiqueta">1. Marca</span>
              <select className="campo" value={marcaId ?? ""} disabled={!!ocupado} onChange={(e) => { setMarcaId(e.target.value ? Number(e.target.value) : null); setLecturas({}); setAvances({}); }}>
                <option value="">Elige una marca…</option>
                {marcas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </label>
          ) : (
            <div className="text-sm"><span className="text-xs text-texto-2">1. Marca</span><div className="font-medium">{marcaNombre(perfil.marcas[0])}</div></div>
          )}
        </div>

        <div>
          <div className="mb-1 text-xs text-texto-2">2. ¿Qué vas a subir?</div>
          <div className="flex flex-wrap gap-2">
            {[...ORDEN_TIPOS, "libro" as const].map((t) => (
              <button
                key={t} type="button" disabled={!!ocupado}
                onClick={() => { setEleccion(t); setArchivo(null); setHojas([]); setLecturas({}); setAvances({}); setInputKey((k) => k + 1); }}
                className={`rounded-lg border px-3 py-2 text-sm ${eleccion === t ? "border-marca bg-marca-suave font-medium text-marca" : "border-linea bg-white hover:bg-fondo"}`}
              >
                {t === "libro" ? "Libro completo (varias hojas)" : NOMBRE_TIPO[t]}
              </button>
            ))}
          </div>
        </div>

        {eleccion && eleccion !== "libro" && (
          <div className="rounded-md bg-fondo p-3 text-xs text-texto-2">
            <b>Columnas necesarias para {NOMBRE_TIPO[eleccion]}:</b> {GUIA_COLUMNAS[eleccion].obligatorias.join(", ")}.
            <span className="text-texto-2"> Opcionales: {GUIA_COLUMNAS[eleccion].opcionales.join(", ")}.</span>{" "}
            Los nombres pueden variar un poco (con o sin tildes).{" "}
            <button type="button" className="text-marca underline" onClick={() => descargarPlantilla(eleccion)}>Descargar plantilla</button>
          </div>
        )}

        {eleccion && (
          <div className="flex flex-wrap items-end gap-4">
            <label><span className="etiqueta">3. Archivo {eleccion === "libro" ? "Excel" : "plano (.csv / .txt) o Excel"}</span>
              <input
                key={inputKey} type="file" className="text-sm" disabled={!!ocupado}
                accept={eleccion === "libro" ? ".xlsx,.xlsm,.xls" : ".csv,.txt,.tsv,.xlsx,.xlsm,.xls"}
                onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
              />
            </label>
            {(eleccion === "inventarios" || eleccion === "libro") && (
              <label title="Algunos archivos traen la fecha del inventario como ###### . Esa fecha se usa solo para esas filas.">
                <span className="etiqueta">Fecha de corte para filas sin fecha (opcional)</span>
                <input type="date" className="campo" value={fechaRespaldo} onChange={(e) => setFechaRespaldo(e.target.value)} />
              </label>
            )}
          </div>
        )}

        {hojas.length > 0 && eleccion && (
          <div className="border-t border-linea-suave pt-3">
            {separador && (
              <p className="mb-2 text-xs text-texto-2">
                Archivo plano · separador detectado: <b>{separador === "\t" ? "tabulación" : separador === ";" ? "punto y coma (;)" : separador === "," ? "coma (,)" : separador}</b>
              </p>
            )}
            {eleccion === "libro" ? (
              <div className="flex flex-wrap gap-3">
                {hojas.map((h) => (
                  <label key={h.nombre} className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${h.tipo ? "border-linea" : "border-dashed border-linea text-texto-3"}`}>
                    <input
                      type="checkbox" disabled={!h.tipo || !!ocupado} checked={elegidas.has(h.nombre)}
                      onChange={(e) => {
                        const s = new Set(elegidas);
                        if (e.target.checked) s.add(h.nombre); else s.delete(h.nombre);
                        setElegidas(s);
                      }}
                    />
                    {h.nombre} <span className="text-xs text-texto-2">{h.tipo ? `→ ${NOMBRE_TIPO[h.tipo]}` : "(no se reconoce)"}</span>
                  </label>
                ))}
              </div>
            ) : hojas.length > 1 ? (
              <label><span className="etiqueta">El archivo tiene varias hojas: ¿cuál es la de {NOMBRE_TIPO[eleccion]}?</span>
                <select className="campo" value={[...elegidas][0] ?? ""} onChange={(e) => setElegidas(new Set([e.target.value]))}>
                  {hojas.map((h) => <option key={h.nombre} value={h.nombre}>{h.nombre}</option>)}
                </select>
              </label>
            ) : null}
            <div className="mt-3">
              <button className="boton" disabled={!!ocupado || elegidas.size === 0 || !marcaId} onClick={leer}>4. Leer y revisar</button>
              {!marcaId && <span className="ml-3 text-xs text-texto-2">Elige primero la marca.</span>}
            </div>
          </div>
        )}
      </div>

      {ocupado && <p className="rounded-md bg-marca-suave p-3 text-sm text-marca">{ocupado}</p>}
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {Object.keys(lecturas).length > 0 && (
        <div className="tarjeta overflow-x-auto !p-0">
          <table className="tabla">
            <thead>
              <tr><th>Hoja</th><th>Tipo</th><th className="num">Filas leídas</th><th className="num">A guardar</th><th>Período</th><th>Sedes</th><th>Avisos</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {Object.entries(lecturas).map(([hoja, l]) => {
                const av = avances[hoja];
                if (l.error) return <tr key={hoja}><td>{hoja}</td><td colSpan={7} className="text-red-700">{l.error}</td></tr>;
                const r = l.res!;
                return (
                  <tr key={hoja} className="align-top">
                    <td className="font-medium">{hoja}</td>
                    <td>{NOMBRE_TIPO[r.tipo]}</td>
                    <td className="num">{fmtNum(r.filasLeidas)}</td>
                    <td className="num">{fmtNum(r.filas.length)}{r.tipo === "ventas" && <div className="text-[10px] text-texto-2">agrupadas por día</div>}</td>
                    <td className="whitespace-nowrap">{r.desde ? `${r.desde} a ${r.hasta}` : r.tipo === "rentabilidad" ? "Reemplaza la carta" : "—"}</td>
                    <td>
                      {(l.sedes ?? []).map((s) => (
                        <div key={s.nombreArchivo} className="whitespace-nowrap text-xs">
                          {s.nombreArchivo}
                          {s.sedeId ? (s.sedeNombre !== s.nombreArchivo ? <span className="text-texto-2"> → {s.sedeNombre}</span> : null)
                            : <span className="ml-1 rounded bg-alerta-suave px-1 text-alerta">sede nueva</span>}
                        </div>
                      ))}
                    </td>
                    <td className="text-xs">
                      {r.filas.length === 0 && <div className="text-texto-2">Hoja vacía, no se guarda</div>}
                      {Object.entries(r.motivosOmision).map(([m, n]) => <div key={m} className="text-alerta">{fmtNum(n)} filas omitidas: {m}</div>)}
                      {r.tipo === "inventarios" && r.motivosOmision["Fecha vacía, futura o no válida"] && !fechaRespaldo && (
                        <div className="text-texto-2">Pon una fecha de corte arriba y vuelve a leer.</div>
                      )}
                    </td>
                    <td className="min-w-48 text-xs">
                      {av ? (
                        <>
                          <div className={av.estado === "error" ? "text-red-700" : av.estado === "ok" ? "text-green-700" : "text-texto-2"}>{av.estado === "ok" ? "✓ " : ""}{av.texto}</div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded bg-linea-suave"><div className="h-full bg-[var(--series-1)] transition-all" style={{ width: `${av.fraccion * 100}%` }} /></div>
                        </>
                      ) : "Sin guardar"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-linea-suave p-3">
            <button className="boton" disabled={!!ocupado || !hayLecturas} onClick={guardar}>5. Guardar en la base de datos</button>
          </div>
        </div>
      )}

      <div className="tarjeta overflow-x-auto !p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
          <h2 className="text-sm font-medium">Historial de cargas</h2>
          <label className="flex items-center gap-2 text-xs text-texto-2">Mes
            <select className="campo !py-1" value={mesHistorial} onChange={(e) => setMesHistorial(e.target.value)}>
              <option value="">Todos</option>
              {mesesHistorial.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}
            </select>
          </label>
        </div>
        <p className="px-4 text-xs text-texto-2">
          Si subiste un archivo equivocado, pulsa <b>Borrar</b> en esa fila: se eliminan solo los datos que entraron con esa carga.
          Una carga marcada como “Reemplazada” ya no tiene datos porque otra posterior la sustituyó.
        </p>
        {aviso && <p className="mx-4 mt-2 rounded-md bg-green-50 p-2 text-sm text-green-800">{aviso}</p>}
        <table className="tabla mt-2">
          <thead>
            <tr>
              <th>Fecha</th>{variasMarcas && <th>Marca</th>}<th>Tipo</th><th>Archivo</th><th>Período</th>
              <th className="num">Filas guardadas</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {historialFiltrado.length === 0 ? <tr><td colSpan={8} className="text-texto-2">{historial.length ? "No hay cargas de ese mes." : "Aún no hay cargas."}</td></tr> : historialFiltrado.map((c) => {
              const n = vigentes[c.id];
              return (
                <tr key={c.id}>
                  <td className="whitespace-nowrap">{new Date(c.created_at).toLocaleString("es-CO")}</td>
                  {variasMarcas && <td>{marcaNombre(c.marca_id)}</td>}
                  <td>{NOMBRE_TIPO[c.tipo as TipoHoja] ?? c.tipo}</td>
                  <td className="max-w-56 truncate" title={`${c.archivo} · hoja ${c.hoja}`}>{c.archivo}</td>
                  <td className="whitespace-nowrap">{c.desde ? `${c.desde} a ${c.hasta}` : "—"}</td>
                  <td className="num">{fmtNum(c.filas_guardadas)}{c.filas_guardadas < c.filas_leidas && <span className="ml-1 text-alerta" title="La carga no terminó">⚠</span>}</td>
                  <td className="whitespace-nowrap text-xs">
                    {n === undefined ? "…" : n > 0 ? <span className="text-green-700">Vigente</span> : <span className="text-texto-2">Reemplazada</span>}
                  </td>
                  <td className="text-right">
                    <button
                      className="rounded-md border border-red-200 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                      disabled={borrando !== null || !!ocupado}
                      onClick={() => borrarCarga(c)}
                    >
                      {borrando === c.id ? "Borrando…" : "Borrar"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
