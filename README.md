# Informe de Rentabilidad Centralizado

Página web donde cada marca (123 Wok, Arrebatao, Sin Par, Casa de Nadie, Rocoto) ve su rentabilidad
con su propio correo y clave, y el administrador ve todas juntas. Todo vive en **una sola base de datos**
de Supabase; la seguridad por marca la hace la base de datos (Row Level Security), no la página.

- **Base de datos:** Supabase, proyecto `informe-rentabilidad-centralizado` (`nmztzhqhnnxyychayeta`)
- **Página:** Next.js 16 desplegada en Vercel

## Qué hace

| Sección | Para qué sirve |
|---|---|
| Resumen | Ventas, costo de venta y % de costo por mes y sede (Cocina, Bar y total) |
| Ventas | Ventas por familia, artículo, tarifa/canal y tipo de documento |
| Compras | Compras por proveedor, familia, centro de costos y artículo |
| Rentabilidad de carta | Precio vs costo de cada plato o bebida, resaltando los que superan el % que elijas |
| Cargar datos | Subir el Excel mensual de la marca; reemplaza el período que trae, sin duplicar |
| Administración | Correos autorizados por marca, sedes y nombres alternos (solo administrador) |

## Fórmula del costo de venta

```
Costo de venta = Inventario inicial + Compras + Traslados recibidos − Inventario final
Inventario inicial del mes = inventario final del mes anterior
% costo = Costo de venta / Ventas sin impuestos
```

Se calcula por separado para **Cocina** y **Bar** (según el centro de costos). Aseo, empaque, utensilios, etc.
se muestran aparte como “Otros costos”. Los centros de producción no suman al costo de las sedes
porque su producción ya llega a las sedes como traslados.

## Cómo entra cada marca

1. El administrador registra el correo en **Administración → Correos con acceso** y le asigna su marca.
2. La persona abre la página, elige **“Activar cuenta”**, escribe su correo y crea su clave.
3. Confirma desde el correo que le llega, y entra con **“Ingresar”**.

Solo los correos registrados pueden crear cuenta (la base de datos rechaza cualquier otro).

## Variables de entorno (Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=https://nmztzhqhnnxyychayeta.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Son llaves públicas: la protección de los datos está en las políticas RLS de la base.

## Desarrollo local

```
npm install
cp .env.example .env.local
npm run dev
```
