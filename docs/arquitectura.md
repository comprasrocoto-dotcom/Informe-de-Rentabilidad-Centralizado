# Arquitectura — Informe de Rentabilidad Centralizado

## 4 de noviembre de 2026 — Primera versión

**Qué se construyó.** Una página web donde cada marca entra con su correo y ve solo su información,
y un administrador (comprasrocoto@gmail.com) ve todas las marcas juntas.

**Cómo están organizados los datos.**

- **Marcas → Sedes.** Cada marca tiene varias sedes (puntos de venta) y, si aplica, un centro de producción.
  - 123 WOK: Oviedo, Interplaza, Laureles, Tesoro + Centro de Producción
  - ARREBATAO: Hot Wings, Malanga del Trópico, Malanga Distrito Vera, Malanga Ciudad del Río
  - SIN PAR: Sin Par
  - CASA DE NADIE: Casa de Nadie
  - ROCOTO: Amsterdam, Laureles, Provenza + Planta de Producción
- **Nombres alternos.** Los Excel nombran la misma sede de varias formas (ej. “ROCOTTO LAURELES”,
  “ROCOTO AMSTERDAM PLAZA”, “MALANGA” vs “MALANGA DEL TROPICO”). La base guarda esa equivalencia,
  así todo cae en la sede correcta. Si llega un nombre nuevo, se crea una sede nueva y el
  administrador puede unirla a la correcta desde “Administración”.
- **Ventas** se guardan sumadas por día y artículo (no factura por factura) para que quepan en el
  plan gratuito de Supabase. Los totales son idénticos a los del Excel.
- **Compras, inventarios, traslados** se guardan línea por línea.
- **Rentabilidad de carta** se reemplaza completa cada vez que se sube.

**Cómo se cargan los datos.** Desde “Cargar datos”, la marca sube su Excel de siempre. La página
lo lee en el navegador, muestra un resumen (filas, fechas, sedes) y al confirmar lo guarda.
Si se vuelve a subir un mes, **reemplaza** ese mes en lugar de duplicarlo.

**Seguridad.** La regla “cada marca solo ve lo suyo” la aplica la base de datos (Row Level Security),
no la página; aunque alguien manipulara la página, la base no le entregaría datos de otra marca.
Solo los correos pre-registrados pueden crear cuenta.

**Verificación hecha.**
- Se leyeron los 5 archivos completos; los totales de ventas, compras, inventarios y traslados
  coinciden exactamente con la suma directa de las columnas del Excel.
- Se probó con un usuario de prueba de Rocoto que solo ve Rocoto y que no ve la lista de correos.
- Se probó que un correo no registrado no puede crear cuenta.

**Limpieza automática de datos al leer el Excel.**
- Encabezados con tildes dañadas (“AlmacÃ©n”) se corrigen solos.
- Fechas escritas como texto (“5/29/2026”) o como número de Excel se convierten.
- Una fecha en el futuro (ej. 05/11/2026 en una hoja de mayo) se interpreta con día y mes invertidos.
- El inventario de Sin Par viene sin fecha (“######”): al subirlo se indica la fecha de corte.

**Preguntas pendientes (no se inventaron, quedan por confirmar):**
1. ¿La fórmula del costo de venta (inv. inicial + compras + traslados − inv. final, sobre ventas sin
   impuestos) es la que usan en los informes actuales?
2. ¿Los descuentos (socios, comerciales, empleados) deben restar de las ventas, como se hace hoy, o mostrarse aparte?
3. ¿Las compras de aseo, empaque y utensilios deben sumar al % de costo o quedarse aparte como ahora?
4. La hoja RENTABILIDAD de 123 Wok trae tarifas de Rocoto, Malanga y Hot Wings, y “ELOTES” aparece con
   costo de $3.181.386. ¿Es una copia de otro archivo?
5. La hoja RENTABILIDAD de Casa de Nadie está vacía.
