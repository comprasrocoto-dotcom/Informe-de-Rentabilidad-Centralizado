/** Logo del Informe de Rentabilidad: barras que suben dentro de un cuadro azul ERP,
 *  con una línea de tendencia que termina en el punto rojo de acento. */
export function Logo({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="Informe de Rentabilidad">
      <rect width="64" height="64" rx="12" fill="#1976d2" />
      <rect x="13" y="38" width="9" height="14" rx="1.5" fill="#ffffff" fillOpacity="0.55" />
      <rect x="27.5" y="30" width="9" height="22" rx="1.5" fill="#ffffff" fillOpacity="0.8" />
      <rect x="42" y="21" width="9" height="31" rx="1.5" fill="#ffffff" />
      <path d="M12 30 L26 20 L36 25 L48 12" fill="none" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="49" cy="11.5" r="4.6" fill="#e11421" stroke="#1976d2" strokeWidth="1.6" />
    </svg>
  );
}

/** Logo + nombre, para fondos oscuros o claros */
export function LogoCompleto({ oscuro = false, size = 36 }: { oscuro?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-3">
      <Logo size={size} />
      <span className="leading-tight">
        <span className={`block text-[15px] font-bold tracking-tight ${oscuro ? "text-white" : "text-tinta"}`}>Informe de Rentabilidad</span>
        <span className={`block text-[11px] tracking-wide uppercase ${oscuro ? "text-white/60" : "text-texto-2"}`}>Centralizado · todas las marcas</span>
      </span>
    </span>
  );
}
