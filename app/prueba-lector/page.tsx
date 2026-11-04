"use client";
import { useState } from "react";
export default function P() {
  const [out, setOut] = useState("listo");
  async function go(f: File) {
    const w = new Worker(new URL("../../lib/lector.worker.ts", import.meta.url), { type: "module" });
    const call = (msg: any, tr: any[] = []) => new Promise<any>((res) => { w.onmessage = (e) => res(e.data); w.postMessage({ ...msg, id: 1 }, tr); });
    const t0 = performance.now();
    const d = await f.arrayBuffer();
    const r = await call({ cmd: "abrir", datos: d }, [d]);
    let log = JSON.stringify(r.hojas) + "\n";
    for (const h of r.hojas) {
      const x = await call({ cmd: "leer", hoja: h.nombre, op: {} });
      log += x.ok ? `${h.nombre}: ${x.res.tipo} ${x.res.filas.length} ${x.res.desde}..${x.res.hasta}\n` : `${h.nombre}: ERROR ${x.error}\n`;
    }
    setOut(log + `ms=${Math.round(performance.now() - t0)}`);
  }
  return <div><input id="f" type="file" onChange={(e) => go(e.target.files![0])} /><pre id="out">{out}</pre></div>;
}
