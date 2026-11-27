# Guía de uso de la bodega

Para el personal de la bodega de mantenimiento. Explica las tareas de todos los días según tu rol. No necesitas saber nada técnico.

> Cada paso de esta guía se comprobó en el sistema el 2026-11-25. Los nombres entre comillas son los textos exactos de los botones y campos.

## Antes de empezar

### Los roles

| Rol | Qué puede hacer |
|---|---|
| **Coordinador** | Todo lo del operador. Además autoriza o rechaza solicitudes, administra productos, lotes, máquinas, proveedores y usuarios, e importa el inventario. |
| **Operador** | Pide entradas, salidas y ajustes de stock, y registra préstamos y devoluciones de herramientas. |
| **Solo lectura** | Consulta el inventario, los movimientos y los préstamos, y exporta. No puede cambiar nada. |

Lo que tu rol no puede hacer no aparece en tu pantalla.

### Entrar por primera vez

1. Abre el sistema y escribe tu **Correo** y la **Contraseña** que te entregó el coordinador. Pulsa **Entrar**.
2. El sistema te pide **«Elige tu contraseña»**. En «Contraseña actual» escribe la que te entregaron. Luego escribe tu contraseña nueva dos veces y pulsa **Guardar y entrar**.
3. Desde ese momento, solo tú conoces tu contraseña.

Marca **«Recordarme en este equipo»** solo en tu computadora o tu celular, nunca en uno compartido.

### Si olvidaste la contraseña

Pídele al coordinador un **enlace para elegir una nueva**. Ábrelo y escribe tu contraseña nueva dos veces. El enlace sirve **una sola vez** durante 24 horas.

### En el celular

Abajo tienes **Inicio**, **Productos**, **Movimientos** y **Préstamos**. Lo demás está en **Más**: Máquinas, Proveedores, Exportar a Excel o CSV, **Cambiar contraseña** (o **Configuración**, si eres coordinador), el tema (claro u oscuro) y **Cerrar sesión**.

En la computadora, esas mismas opciones están en el menú que se abre al pulsar tu nombre, arriba a la derecha.

### La campana

La campana de arriba avisa del stock bajo, de las solicitudes por autorizar y de los lotes por vencer. Púlsala para ver el detalle.

---

## Operador

### Pedir una salida (sacar repuestos de la bodega)

1. En **Inicio**, pulsa **Pedir salida**.
2. En **Producto**, busca por código o nombre y elige el producto. Al lado se ve cuánto hay disponible.
3. Indica la **Cantidad**. Si el producto usa lotes, elige el **Lote**.
4. Opcional: la **Máquina destino** y la **Orden de trabajo**.
5. Escribe el **Motivo**. En las salidas es obligatorio.
6. Pulsa **Enviar solicitud**. Aparece «Solicitud enviada.».

La solicitud queda **Pendiente**: **el stock no cambia hasta que el coordinador la autorice**. A la derecha, «Qué pasa al enviar» muestra cuánto quedaría.

### Pedir una entrada (llegó mercadería)

Igual que la salida, pero pulsa **Pedir entrada**. El motivo es opcional.

Si el producto usa lotes y el lote es nuevo, pídele al coordinador que lo registre primero.

### Pedir un ajuste (el conteo no coincide)

1. En **Movimientos**, pulsa **Nueva solicitud** y elige **Ajuste**.
2. En **«Cantidad contada en bodega»** escribe lo que contaste. No escribas la diferencia.
3. Escribe el **Motivo** (obligatorio) y pulsa **Enviar solicitud**.

### Ver tus solicitudes

En **Inicio**, el panel **Mis solicitudes** muestra las que esperan revisión. En **Movimientos** ves todas, con su estado: Pendiente, Autorizado o Rechazado.

### Prestar una herramienta

1. En **Inicio**, pulsa **Prestar herramienta**. Se abre **Préstamos**.
2. En **Nuevo préstamo**:
   - Elige la **Herramienta**.
   - Escribe el nombre completo del **Trabajador**. No necesita cuenta en el sistema.
   - Indica la **Cantidad**.
3. Pulsa **Registrar préstamo**. Aparece «Préstamo registrado.».

Una herramienta prestada no se puede sacar con una salida mientras esté fuera. Los productos con lotes no se prestan.

### Registrar una devolución

1. En **Inicio**, pulsa **Devolver**. También puedes hacerlo desde **Préstamos**, en la pestaña «Prestadas».
2. Busca el préstamo y pulsa **Devolver**.
3. Comprueba que la herramienta está en la bodega y en buen estado, y pulsa **Sí, ya está en bodega**. Aparece «Devolución registrada.».

---

## Coordinador

El coordinador puede hacer todo lo del operador, más lo siguiente.

### Autorizar o rechazar solicitudes

1. En **Inicio**, el panel **Por autorizar** muestra las solicitudes pendientes. Pulsa **Revisar** en una.
2. Revisa el producto, la cantidad, quién la pidió, el motivo y cuánto quedaría.
3. Para aceptarla:
   - Pulsa **Autorizar y aplicar al stock**.
   - Confirma con **Sí, autorizar y aplicar**.
   - El stock cambia en ese momento.
4. Para rechazarla:
   - Pulsa **Rechazar**.
   - Confirma con **Sí, rechazar**.
   - El stock no cambia, y quien la pidió la verá como Rechazada.

Si una salida pide más de lo disponible, el sistema muestra «La salida supera lo disponible» y **no deja autorizarla**. Solo se puede rechazar.

Una solicitud autorizada no se deshace: para corregirla, registra el movimiento contrario o un ajuste.

### Tus propias solicitudes

Si en **Configuración** (menú de tu nombre) está activado **«Autorizar automáticamente las solicitudes del coordinador»**, tus solicitudes se aplican al enviarlas y aparece «Solicitud autorizada automáticamente.». Si alguna regla lo impide, por ejemplo falta stock, la solicitud queda Pendiente y el sistema te explica por qué.

### Productos

- **Crear:** en **Productos**, pulsa **Nuevo producto**. Llena:
  - el **Código interno** (único), el **Nombre**, la **Categoría** y la **Unidad**;
  - el stock **Mínimo** y, si quieres, el **Máximo**;
  - la **Ubicación física**.
- **Editar:** abre el producto desde la lista, cambia los datos y pulsa **Guardar cambios**. El **Stock actual** no se edita: solo cambia con movimientos autorizados.
- **Desactivar o reactivar:** desde la ficha del producto. Un producto desactivado no admite movimientos y conserva su historial.
- **Lotes:** si el producto usa lotes («Requiere lote y fecha de vencimiento»):
  1. Entra a **Lotes** y pulsa **Nuevo lote**. Escribe el **Número de lote** como viene en la etiqueta y la **Fecha de vencimiento**.
  2. Luego pulsa **Pedir entrada con lote**.

Cuando un producto llega a su mínimo, aparece en **Alertas de stock bajo** en Inicio.

### Importar el inventario desde Excel

Para cargar muchos productos de una vez.

1. En **Productos**, pulsa **Importar**.
2. Pulsa **Descargar plantilla** y llénala. La hoja «Instrucciones» explica cada columna.
3. Pulsa **Elegir archivo** y sube tu Excel. **Todavía no se guarda nada.**
4. Revisa la vista previa:
   - Las filas en rojo tienen errores. Corrígelas en el archivo y vuelve a subirlo.
   - Las filas marcadas **«Ya existe»** muestran qué cambiaría. Marca **«Actualizar con los datos del archivo»** solo en las que quieras reemplazar.
5. Pulsa **Importar** y confirma. Se carga todo o nada.

El stock inicial queda registrado como una entrada «Carga inicial».

### Máquinas y proveedores

- En **Máquinas**, pulsa **Nueva máquina**. Luego, en **Ver repuestos**, pulsa **Vincular repuesto** para indicar qué productos usa. Esa lista ayuda al elegir la máquina destino de una salida.
- En **Proveedores**, pulsa **Nuevo proveedor**. Luego, en su ficha, pulsa **Agregar producto** para indicar qué ofrece y a qué precio de referencia.

### Usuarios

- **Crear:** en **Usuarios**, pulsa **Nuevo usuario**. Llena:
  - el **Nombre completo**, el **Usuario**, el **Correo** y el **Rol**;
  - una **Contraseña inicial** de al menos 8 caracteres.

  Entrégale la contraseña en persona. Al entrar, deberá elegir la suya.
- **Si alguien olvidó su contraseña:**
  1. Pulsa el **candado** en su fila. En el celular, el botón es **Restablecer contraseña**.
  2. Pulsa **Crear enlace** y luego **Copiar enlace**.

  El enlace **solo se muestra esta vez**. Entrégaselo únicamente a esa persona, en persona o por mensaje privado. Nadie más conoce su contraseña, ni siquiera tú.
- **Desactivar:** pulsa el botón de apagado y confirma con **Sí, desactivar**. La persona ya no puede entrar y su historial se conserva. Se puede **Reactivar** cuando quieras.

Siempre debe quedar al menos un coordinador activo.

---

## Solo lectura

Puedes consultar todo sin cambiar nada:

- **Productos:** stock, ubicación, mínimos y lotes. Arriba verás «Acceso de solo lectura».
- **Movimientos:** todas las solicitudes y su estado.
- **Préstamos:** qué herramientas están fuera y quién las tiene.

Si necesitas un repuesto, habla con el coordinador.

---

## Para todos

### Exportar a Excel o CSV

1. En la computadora, pulsa tu nombre arriba a la derecha y elige **Exportar a Excel o CSV**. En el celular, entra a **Más › Exportar a Excel o CSV**.
2. Elige qué descargar:
   - **Inventario completo:** productos, stock con lotes, máquinas y proveedores. Elige **Excel** o **CSV**; en CSV, elige además qué datos. Pulsa **Descargar inventario**.
   - **Historial de movimientos:** elige las fechas **Desde** y **Hasta**, y si quieres, el **Tipo** y el **Estado**. Pulsa **Descargar movimientos**.

Las fechas salen en la hora de tu dispositivo, igual que en pantalla.

### Cambiar tu contraseña

Esto es para cuando **recuerdas** tu contraseña y quieres cambiarla. Si la olvidaste, mira «Si olvidaste la contraseña» al inicio.

Abre el menú de tu nombre, arriba a la derecha (en el celular, **Más**), y elige **Cambiar contraseña**. Si eres coordinador, elige **Configuración**: la sección **Cambiar contraseña** está al final. Luego:

1. Escribe tu **Contraseña actual**.
2. Escribe la **Contraseña nueva** dos veces.
3. Pulsa **Cambiar contraseña**. Tus sesiones en otros equipos se cierran; en este sigues conectado.

### Cerrar sesión y tema

En la computadora, pulsa tu nombre arriba a la derecha: ahí están **Cerrar sesión** y el tema (claro u oscuro). En el celular están en **Más**. Cierra sesión siempre en un equipo compartido.

### Si aparece un error

- **«No hay conexión con el servidor»:** revisa el Wi-Fi. Lo que escribiste no se pierde: vuelve a intentarlo cuando regrese la señal.
- **Otros mensajes:** dicen qué pasó y qué hacer. Si no se resuelve, avisa al coordinador y dile el código que aparece junto al mensaje, por ejemplo `STOCK_INSUFICIENTE · 400`.
