// Tarjetas de indicadores con color propio según el tema (ventas, compras, costo, utilidad, inventario…).
// El color sale del título, así todas las páginas quedan consistentes sin configurar cada tarjeta.

export type Tema = { color: string; oscuro: string; icono: string };

const I = {
  ventas: "M3 17l6-6 4 4 8-8M15 7h6v6",
  compras: "M3 4h2l2.4 11.2a1 1 0 001 .8h9.2a1 1 0 001-.8L20 8H6.2M9 20a1 1 0 100-2 1 1 0 000 2zm9 0a1 1 0 100-2 1 1 0 000 2z",
  costo: "M12 3v18M17 7.5c0-1.9-2.2-3.5-5-3.5s-5 1.6-5 3.5 2.2 3 5 3.5 5 1.6 5 3.5-2.2 3.5-5 3.5-5-1.6-5-3.5",
  utilidad: "M4 19h16M6 15l4-4 3 3 5-6M14 8h4v4",
  inventario: "M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7M12 11v10",
  traslados: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4z",
  sedes: "M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11zm0-8a3 3 0 100-6 3 3 0 000 6z",
  conteo: "M4 6h16M4 12h16M4 18h10",
  factura: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  fabrica: "M3 21V10l5 3V10l5 3V6l8 4v11zM3 21h18",
  reparto: "M12 3a9 9 0 109 9h-9zM14 3.3A9 9 0 0120.7 10H14z",
  alerta: "M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
};

export const TEMAS = {
  ventas: { color: "#1976d2", oscuro: "#0d47a1", icono: I.ventas },
  compras: { color: "#ef6c00", oscuro: "#a84300", icono: I.compras },
  costo: { color: "#8e24aa", oscuro: "#6a1b9a", icono: I.costo },
  utilidad: { color: "#2e7d32", oscuro: "#1b5e20", icono: I.utilidad },
  inventario: { color: "#00897b", oscuro: "#00695c", icono: I.inventario },
  traslados: { color: "#3949ab", oscuro: "#283593", icono: I.traslados },
  sedes: { color: "#0288d1", oscuro: "#01579b", icono: I.sedes },
  conteo: { color: "#546e7a", oscuro: "#37474f", icono: I.conteo },
  factura: { color: "#0097a7", oscuro: "#006064", icono: I.factura },
  fabrica: { color: "#6d4c41", oscuro: "#4e342e", icono: I.fabrica },
  reparto: { color: "#c2185b", oscuro: "#880e4f", icono: I.reparto },
  sanAgustin: { color: "#1976d2", oscuro: "#0d47a1", icono: I.fabrica },
  rocoto: { color: "#eb6834", oscuro: "#a8401a", icono: I.fabrica },
  alerta: { color: "#d32f2f", oscuro: "#b71c1c", icono: I.alerta },
  bien: { color: "#2e7d32", oscuro: "#1b5e20", icono: I.utilidad },
} satisfies Record<string, Tema>;

export function temaDe(titulo: string): Tema {
  const t = titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (t.startsWith("san agustin")) return TEMAS.sanAgustin;
  if (t.startsWith("rocoto")) return TEMAS.rocoto;
  if (/compartid|repartir/.test(t)) return TEMAS.reparto;
  if (/utilidad|margen/.test(t)) return TEMAS.utilidad;
  if (/fabrica|insumo/.test(t)) return TEMAS.fabrica;
  if (/mercancia|costo|ficha/.test(t)) return TEMAS.costo;
  if (/inventario|referencia/.test(t)) return TEMAS.inventario;
  if (/traslad|abastecimiento|documento|articulos distintos/.test(t)) return TEMAS.traslados;
  if (/compra|proveedor|familia/.test(t)) return TEMAS.compras;
  if (/sede|centro de costo/.test(t)) return TEMAS.sedes;
  if (/factura|ticket/.test(t)) return TEMAS.factura;
  if (/unidad|producto|plato/.test(t)) return TEMAS.conteo;
  return TEMAS.ventas;
}

export function TarjetaColor({ titulo, valor, exacto, nota, tema, apagada }: {
  titulo: string; valor: string; exacto?: string; nota?: React.ReactNode; tema?: Tema; apagada?: boolean;
}) {
  const t = tema ?? temaDe(titulo);
  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded border bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-md ${apagada ? "border-dashed opacity-70" : ""}`}
      style={{ borderColor: `${t.color}40`, borderTop: `4px solid ${t.color}`, backgroundImage: `linear-gradient(135deg, ${t.color}24 0%, ${t.color}0a 50%, #ffffff 80%)` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-bold tracking-wide uppercase" style={{ color: t.oscuro }}>{titulo}</div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm" style={{ background: t.color }} aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={t.icono} /></svg>
        </span>
      </div>
      <div className="-mt-1 text-[24px] leading-tight font-bold tracking-tight tabular-nums" style={{ color: t.oscuro }}>{valor}</div>
      {exacto && <div className="mt-0.5 text-xs font-medium text-texto-2 tabular-nums">{exacto}</div>}
      {nota && <div className="mt-1.5 text-[11px] leading-snug text-texto-2">{nota}</div>}
    </div>
  );
}
