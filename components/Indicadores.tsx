import { fmtFecha, fmtMes, fmtPct, fmtPesos } from "@/lib/formato";
import type { Cifras } from "@/lib/rentabilidad";

/** Tarjeta de indicador: valor principal (resumido) y, debajo, el valor exacto y una nota. */
export function Tarjeta({ titulo, valor, exacto, nota, tono }: { titulo: string; valor: string; exacto?: string; nota?: React.ReactNode; tono?: "bien" | "alerta" }) {
  return (
    <div className={`tarjeta flex flex-col ${tono === "alerta" ? "border-l-4 border-l-alerta" : tono === "bien" ? "border-l-4 border-l-bien" : ""}`}>
      <div className="text-xs font-medium text-texto-2">{titulo}</div>
      <div className={`mt-1.5 text-xl font-semibold tabular-nums ${tono === "alerta" ? "text-alerta" : tono === "bien" ? "text-bien" : "text-tinta"}`}>{valor}</div>
      {exacto && <div className="text-xs text-texto-2 tabular-nums">{exacto}</div>}
      {nota && <div className="mt-1 text-[11px] leading-snug text-texto-3">{nota}</div>}
    </div>
  );
}

/** Cómo se obtuvo el inventario inicial / final */
export function notaConteo(c: Cifras, cual: "ini" | "fin") {
  if (cual === "ini") {
    if (!c.tieneIni) return "Sin conteo inicial del período";
    if (c.heredado) return `Heredado del cierre del ${fmtFecha(c.fIni)}`;
    return c.fIni ? `Conteo del ${fmtFecha(c.fIni)}` : "Conteo inicial";
  }
  if (!c.tieneFin) return "Sin conteo final del período";
  return c.fFin ? `Conteo del ${fmtFecha(c.fFin)}` : "Conteo final";
}

export function notaMV(c: Cifras) {
  if (c.completo) return c.heredado ? "Inv. inicial (heredado) + Compras − Inv. final" : "Inv. inicial + Compras − Inv. final";
  return "Solo compras: falta un conteo de inventario";
}

/** Insignia de % de costo frente a la meta */
export function PctMeta({ pct, meta }: { pct: number | null; meta: number }) {
  if (pct == null) return <span>—</span>;
  const alto = pct > meta;
  return (
    <span className={`font-medium ${alto ? "text-alerta" : "text-bien"}`} title={alto ? `Por encima de la meta (${fmtPct(meta)})` : `Dentro de la meta (${fmtPct(meta)})`}>
      {alto ? "▲ " : ""}{fmtPct(pct)}
    </span>
  );
}

export function DetalleExcluidas({ c }: { c: Cifras }) {
  const pe = c.ventasTot ? c.excluidas / c.ventasTot : 0;
  return (
    <div className="tarjeta">
      <h3 className="text-sm font-semibold text-tinta">Ventas que entran al cálculo del costo</h3>
      <p className="mb-3 text-xs text-texto-3">Ventas base = ventas totales − ventas excluidas. Los descuentos y notas crédito siguen restando.</p>
      <dl className="space-y-1.5 text-[13px]">
        <div className="flex justify-between gap-4"><dt className="text-texto-2">Ventas totales</dt><dd className="tabular-nums">{fmtPesos(c.ventasTot)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-texto-2">Ventas base (Cocina + Bar)</dt><dd className="font-medium tabular-nums text-tinta">{fmtPesos(c.ventasBase)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-texto-2">Ventas excluidas (ej. Parking)</dt><dd className="tabular-nums text-alerta">{fmtPesos(c.excluidas)}</dd></div>
        <div className="flex justify-between gap-4 border-t border-linea pt-1.5"><dt className="text-texto-2">Puntos porcentuales excluidos</dt><dd className="tabular-nums">{(pe * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} p.p.</dd></div>
        {c.ajustes !== 0 && (
          <div className="flex justify-between gap-4"><dt className="text-texto-3">Incluye descuentos y notas crédito</dt><dd className="tabular-nums text-texto-3">{fmtPesos(c.ajustes)}</dd></div>
        )}
      </dl>
    </div>
  );
}

export const etiquetaMes = (m: string) => fmtMes(m);
