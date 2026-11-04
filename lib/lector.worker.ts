/// <reference lib="webworker" />
// Lee el Excel en segundo plano para no congelar la pantalla con archivos grandes.
import { leerHoja, listarHojas, type OpcionesImportacion } from "./importador";

let datos: ArrayBuffer | null = null;

type Msg =
  | { id: number; cmd: "abrir"; datos: ArrayBuffer }
  | { id: number; cmd: "leer"; hoja: string; op: OpcionesImportacion };

self.onmessage = (e: MessageEvent<Msg>) => {
  const m = e.data;
  try {
    if (m.cmd === "abrir") {
      datos = m.datos;
      self.postMessage({ id: m.id, ok: true, hojas: listarHojas(datos) });
    } else if (m.cmd === "leer") {
      if (!datos) throw new Error("Primero abre un archivo");
      self.postMessage({ id: m.id, ok: true, res: leerHoja(datos, m.hoja, m.op) });
    }
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
