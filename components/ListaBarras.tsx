/** Ranking con barras horizontales (más legible que una dona para comparar participaciones). */
export function ListaBarras({
  titulo, filas, formato, nota, color = "var(--series-1)", vacio = "Sin datos para este filtro",
}: {
  titulo: string;
  filas: { k: string; v: number; detalle?: string; alerta?: boolean }[];
  formato: (v: number) => string;
  nota?: string;
  color?: string;
  vacio?: string;
}) {
  const max = Math.max(1e-9, ...filas.map((f) => Math.abs(f.v)));
  return (
    <div className="tarjeta">
      <h3 className="text-sm font-semibold text-tinta">{titulo}</h3>
      {nota && <p className="text-xs text-texto-3">{nota}</p>}
      {filas.length === 0 ? (
        <p className="mt-3 text-sm text-texto-3">{vacio}</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {filas.map((f, i) => (
            <li key={`${f.k}-${i}`} className="text-[13px]">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-texto" title={f.k}>
                  <span className="mr-1.5 inline-block w-5 text-right text-xs text-texto-3 tabular-nums">{i + 1}</span>
                  {f.k}
                </span>
                <span className={`shrink-0 tabular-nums ${f.alerta ? "font-medium text-alerta" : "text-texto"}`}>{formato(f.v)}</span>
              </div>
              <div className="mt-1 ml-[26px] flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-linea-suave">
                  <div className="h-full rounded-full" style={{ width: `${(Math.abs(f.v) / max) * 100}%`, background: f.alerta ? "var(--alerta)" : color }} />
                </div>
                {f.detalle && <span className="shrink-0 text-[11px] text-texto-3">{f.detalle}</span>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
