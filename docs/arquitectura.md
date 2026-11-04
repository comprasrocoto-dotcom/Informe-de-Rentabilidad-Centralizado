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

**Decisiones confirmadas por Mariluz (4 nov 2026):**
1. Costo de venta = inventario inicial + compras + traslados − inventario final, sobre ventas sin impuestos. ✔
2. El informe de rentabilidad (Resumen) usa **solo los centros de costo Cocina y Bar**, tanto en ventas como en costos.
   Descuentos y otras ventas se siguen viendo en la sección Ventas y como nota informativa en el Resumen.
3. Aseo, empaque y utensilios quedan aparte como “Otros costos” y no suman al % de costo. ✔
4. Las hojas de RENTABILIDAD de 123 Wok y Casa de Nadie se volverán a subir con la información correcta.

## 4 de noviembre de 2026 — Un correo puede ver varias marcas

**Qué cambió.** Antes cada correo tenía una sola marca. Ahora un correo puede tener varias, y quien
tenga más de una ve un selector para cambiar entre ellas (o verlas todas juntas).

**Accesos registrados:**
- comprasrocoto@gmail.com → Administrador (todas las marcas)
- admi.inversionesrocoto@hotmail.com → ROCOTO y ARREBATAO
- tatiana123wok@gmail.com → 123 WOK, SIN PAR y CASA DE NADIE

**Verificación.** Se simuló el ingreso de tatiana123wok@gmail.com: ve solo 123 Wok, Sin Par y Casa de Nadie;
no ve Rocoto ni Arrebatao ni la lista de correos.

## 4 de noviembre de 2026 — Cargar cada tipo de información por separado (archivo plano)

**Qué cambió.** En “Cargar datos” ahora primero se elige qué se va a subir: Compras, Inventarios,
Traslados, Ventas o Rentabilidad de carta (o, si se prefiere, el libro de Excel completo como antes).
Luego se sube el archivo de ese tipo, que puede ser:
- **Archivo plano** (.csv o .txt) separado por punto y coma, coma o tabulación. La página detecta sola el separador
  y las tildes (archivos guardados desde Excel en español o en UTF-8).
- **Excel** de una sola hoja (o de varias: se elige cuál).

Para cada tipo se muestran las columnas necesarias y hay una **plantilla descargable** con los encabezados.

**Números y fechas en archivos planos.** Se aceptan formatos colombianos (1.234.567,89 y fechas dd/mm/aaaa)
y también los de punto decimal. Se probó con las compras de Sin Par (separadas por ;, con coma decimal) y los
traslados de Rocoto (separados por coma): los totales coinciden exactamente con los Excel originales.

## 4 de noviembre de 2026 — Borrar una carga equivocada

En “Cargar datos → Historial de cargas” cada carga tiene un botón **Borrar**. Elimina únicamente los datos
que entraron con esa carga (y la quita del historial), después de pedir confirmación. El historial también
muestra si cada carga está **Vigente** o fue **Reemplazada** por una carga posterior del mismo período.

La seguridad la aplica la base de datos: un usuario solo puede borrar cargas de sus propias marcas
(se probó que el usuario de Rocoto/Arrebatao no puede borrar una carga de 123 Wok).
