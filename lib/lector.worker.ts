/// <reference lib="webworker" />
// Lee el archivo en segundo plano para no congelar la pantalla con archivos grandes.
import { crearFuente, leerHoja, listarHojas, type Fuente, type OpcionesImportacion, type TipoHoja } from "./importador";

let fuente: Fuente | null = null;

type Msg =
  | { id: number; cmd: "abrir"; nombre: string; datos: ArrayBuffer }
  | { id: number; cmd: "leer"; hoja: string; op: OpcionesImportacion; tipo?: TipoHoja | null };

self.onmessage = (e: MessageEvent<Msg>) => {
  const m = e.data;
  try {
    if (m.cmd === "abrir") {
      fuente = crearFuente(m.nombre, m.datos);
      self.postMessage({
        id: m.id, ok: true, hojas: listarHojas(fuente),
        plano: fuente.clase === "plano" ? { separador: fuente.separador } : null,
      });
    } else if (m.cmd === "leer") {
      if (!fuente) throw new Error("Primero abre un archivo");
      self.postMessage({ id: m.id, ok: true, res: leerHoja(fuente, m.hoja, m.op, m.tipo ?? null) });
    }
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
