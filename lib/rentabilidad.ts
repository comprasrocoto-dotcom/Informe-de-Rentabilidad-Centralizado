// Cálculo del costo de venta a partir del resumen mensual que entrega la base de datos.
//
//   Costo de venta = Inventario inicial + Compras + Traslados recibidos − Inventario final
//   Inventario inicial de un mes = inventario final del mes anterior.
//   % costo = Costo de venta / Ventas (base, sin impuestos)
//
// Los centros de producción (tipo "produccion") no venden: su costo llega a las sedes
// por medio de los traslados, así que se excluyen de los totales para no contarlo dos veces.

export type FilaResumen = {
  marca_id: number; sede_id: number; mes: string; grupo: "Cocina" | "Bar" | "Descuentos" | "Otros";
  ventas: number; compras: number; traslados: number; inv_inicial: number; inv_final: number;
};

export type Bloque = {
  ventas: number; ventasCocina: number; ventasBar: number; descuentos: number;
  compras: number; traslados: number; invInicial: number; invFinal: number;
  costoCocina: number; costoBar: number; costoOtros: number;
  sinInvInicial: boolean; sinInvFinal: boolean;
};

export const bloqueVacio = (): Bloque => ({
  ventas: 0, ventasCocina: 0, ventasBar: 0, descuentos: 0, compras: 0, traslados: 0,
  invInicial: 0, invFinal: 0, costoCocina: 0, costoBar: 0, costoOtros: 0,
  sinInvInicial: false, sinInvFinal: false,
});

export function sumarFila(b: Bloque, f: FilaResumen) {
  const v = Number(f.ventas), c = Number(f.compras), t = Number(f.traslados), ii = Number(f.inv_inicial), fi = Number(f.inv_final);
  b.ventas += v;
  if (f.grupo === "Cocina") b.ventasCocina += v;
  if (f.grupo === "Bar") b.ventasBar += v;
  if (f.grupo === "Descuentos") b.descuentos += v;
  const costo = ii + c + t - fi;
  if (f.grupo === "Cocina" || f.grupo === "Bar") {
    b.compras += c; b.traslados += t; b.invInicial += ii; b.invFinal += fi;
  }
  if (f.grupo === "Cocina") b.costoCocina += costo;
  else if (f.grupo === "Bar") b.costoBar += costo;
  else b.costoOtros += costo;
}

export function sumarBloques(a: Bloque, b: Bloque) {
  for (const k of Object.keys(a) as (keyof Bloque)[]) {
    if (typeof a[k] === "number") (a[k] as number) += b[k] as number;
    else (a[k] as boolean) = (a[k] as boolean) || (b[k] as boolean);
  }
}

/** Marca meses con ventas pero sin conteo de inventario (el % saldría distorsionado). */
export function marcarIncompleto(b: Bloque) {
  if (b.ventas !== 0) {
    if (b.invInicial === 0) b.sinInvInicial = true;
    if (b.invFinal === 0) b.sinInvFinal = true;
  }
}

export const costoAB = (b: Bloque) => b.costoCocina + b.costoBar;
