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

/** Valor resumido en millones con signo de pesos: $ 1.063,8 M */
export const fmtM = (n: number | null | undefined) => {
  if (n == null || !isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a < 1_000_000) return fmtPesos(n);
  return `${n < 0 ? "-" : ""}$ ${(a / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} M`;
};
/** Fecha ISO a dd/mm/aaaa */
export const fmtFecha = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
