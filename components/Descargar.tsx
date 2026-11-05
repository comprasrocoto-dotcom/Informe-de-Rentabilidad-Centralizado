"use client";

import { useEffect, useRef, useState } from "react";

const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

// Descarga lo que se ve en la página actual:
//  · Excel: cada tabla de la página en su propia hoja, con los números como números (pesos, %, kilos).
//  · PDF: usa la impresión del navegador con un diseño limpio (sin menú, con el encabezado del informe).

type Celda = string | number | null;

function aNumero(txt: string): { v: Celda; z?: string } {
  const t = txt.replace(/ /g, " ").trim();
  if (!t || t === "—" || t === "-") return { v: null };
  const m = t.match(/^(-?)\s*(\$)?\s*(-?)([\d.]+(?:,\d+)?)\s*(%|kg|M)?$/i);
  if (!m) return { v: t };
  const neg = m[1] === "-" || m[3] === "-";
  let n = Number(m[4].replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return { v: t };
  if (neg) n = -n;
  const suf = m[5]?.toLowerCase();
  if (suf === "%") return { v: n / 100, z: "0.0%" };
  if (suf === "m") return { v: n * 1_000_000, z: '"$" #,##0' };
  if (suf === "kg") return { v: n, z: '#,##0.0 "kg"' };
  if (m[2]) return { v: n, z: '"$" #,##0' };
  return { v: n, z: Number.isInteger(n) ? "#,##0" : "#,##0.##" };
}

function tituloDeTabla(tabla: HTMLTableElement, i: number) {
  let el: HTMLElement | null = tabla;
  while (el && el.tagName !== "MAIN") {
    const h = el.querySelector?.("h2, h3");
    if (h && h.textContent && !tabla.contains(h)) return h.textContent.trim();
    el = el.parentElement;
  }
  return `Tabla ${i + 1}`;
}

function contexto() {
  const titulo = document.querySelector("main h1")?.textContent?.trim() || document.title;
  const seccion = [...document.querySelectorAll("header [data-seccion]")].map((e) => e.textContent?.trim()).filter(Boolean).join(" · ");
  const filtros: string[] = [];
  document.querySelectorAll<HTMLSelectElement | HTMLInputElement>("main select, main input[type=date], main input[type=month]").forEach((c) => {
    const etiqueta = c.closest("label")?.querySelector("span, div")?.textContent?.trim() || c.getAttribute("aria-label") || "";
    const valor = c instanceof HTMLSelectElement ? c.selectedOptions[0]?.textContent?.trim() : c.value;
    if (valor) filtros.push(etiqueta ? `${etiqueta}: ${valor}` : valor);
  });
  document.querySelectorAll("main [aria-pressed=true], main button.boton[data-filtro]").forEach((b) => b.textContent && filtros.push(b.textContent.trim()));
  return { titulo, seccion, filtros };
}

async function descargarExcel() {
  const XLSX = await import("xlsx");
  const tablas = [...document.querySelectorAll<HTMLTableElement>("main table")];
  const { titulo, seccion, filtros } = contexto();
  const wb = XLSX.utils.book_new();
  const portada = XLSX.utils.aoa_to_sheet([
    ["Informe de Rentabilidad"], [titulo], [seccion], [],
    ["Filtros", filtros.join(" · ") || "—"],
    ["Descargado", new Date().toLocaleString("es-CO")],
    ["Tablas", tablas.length],
  ]);
  portada["!cols"] = [{ wch: 14 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, portada, "Informe");
  const usados = new Set<string>(["Informe"]);
  tablas.forEach((tabla, i) => {
    const filas: { v: Celda; z?: string }[][] = [];
    tabla.querySelectorAll("tr").forEach((tr) => {
      const fila: { v: Celda; z?: string }[] = [];
      tr.querySelectorAll("th, td").forEach((c) => {
        const txt = (c as HTMLElement).innerText ?? c.textContent ?? "";
        const span = Number((c as HTMLTableCellElement).colSpan) || 1;
        fila.push(c.tagName === "TH" ? { v: txt.trim() } : aNumero(txt));
        for (let k = 1; k < span; k++) fila.push({ v: null });
      });
      if (fila.some((x) => x.v !== null && x.v !== "")) filas.push(fila);
    });
    if (!filas.length) return;
    const ws = XLSX.utils.aoa_to_sheet(filas.map((f) => f.map((x) => x.v)));
    filas.forEach((f, r) => f.forEach((x, c) => {
      if (x.z && typeof x.v === "number") { const ref = XLSX.utils.encode_cell({ r, c }); if (ws[ref]) ws[ref].z = x.z; }
    }));
    const anchos = filas[0].map((_, c) => ({ wch: Math.min(50, Math.max(10, ...filas.map((f) => String(f[c]?.v ?? "").length + 2))) }));
    ws["!cols"] = anchos;
    let nombre = tituloDeTabla(tabla, i).replace(/[\\/?*[\]:]/g, " ").slice(0, 28).trim() || `Tabla ${i + 1}`;
    let n = 2; const base = nombre;
    while (usados.has(nombre)) nombre = `${base.slice(0, 25)} ${n++}`;
    usados.add(nombre);
    XLSX.utils.book_append_sheet(wb, ws, nombre);
  });
  const archivo = `${titulo}`.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "_").replace(/^_|_$/g, "").toLowerCase();
  XLSX.writeFile(wb, `${archivo || "informe"}_${hoy()}.xlsx`);
}

function descargarPdf() {
  const { titulo } = contexto();
  const anterior = document.title;
  document.title = `${titulo} ${hoy()}`;
  window.print();
  setTimeout(() => (document.title = anterior), 500);
}

export function Descargar() {
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [abierto]);
  return (
    <div ref={ref} className="relative flex items-stretch">
      <button onClick={() => setAbierto((v) => !v)} disabled={ocupado} className="flex items-center gap-1.5 px-4 text-[13px] text-white hover:bg-white/10" aria-expanded={abierto}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 4v12m0 0l-4-4m4 4l4-4M4 18v2h16v-2" /></svg>
        {ocupado ? "Preparando…" : "Descargar"}
      </button>
      {abierto && (
        <div className="absolute top-full right-0 z-50 w-72 rounded-sm border border-linea bg-white py-1 text-sm text-texto shadow-xl">
          <button className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-marca-suave" onClick={async () => { setAbierto(false); setOcupado(true); try { await descargarExcel(); } finally { setOcupado(false); } }}>
            <span className="mt-0.5 rounded-sm bg-[#1d6f42] px-1.5 py-0.5 text-[10px] font-bold text-white">XLS</span>
            <span><b className="block font-medium">Excel</b><span className="text-xs text-texto-2">Cada tabla de esta página en una hoja, con los filtros aplicados</span></span>
          </button>
          <button className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-marca-suave" onClick={() => { setAbierto(false); setTimeout(descargarPdf, 50); }}>
            <span className="mt-0.5 rounded-sm bg-alerta px-1.5 py-0.5 text-[10px] font-bold text-white">PDF</span>
            <span><b className="block font-medium">PDF</b><span className="text-xs text-texto-2">La página completa con gráficos, lista para guardar o imprimir. Elige “Guardar como PDF”.</span></span>
          </button>
        </div>
      )}
    </div>
  );
}
