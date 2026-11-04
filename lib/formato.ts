const pesos = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const entero = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

export const fmtPesos = (n: number | null | undefined) => (n == null || !isFinite(n) ? "—" : pesos.format(n));
export const fmtNum = (n: number | null | undefined) => (n == null || !isFinite(n) ? "—" : entero.format(n));
export const fmtDec = (n: number | null | undefined) => (n == null || !isFinite(n) ? "—" : decimal.format(n));
export const fmtPct = (n: number | null | undefined) =>
  n == null || !isFinite(n) ? "—" : `${(n * 100).toLocaleString("es-CO", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;

/** Millones abreviados para ejes de gráficos: 12,3 M */
export const fmtMillones = (n: number) => `${(n / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`;

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const fmtMes = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return `${MESES[m - 1]} ${y}`;
};

export const div = (a: number, b: number) => (b ? a / b : null);
