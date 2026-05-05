# Diseño de base de datos

## 1. Diagrama entidad–relación

### 1.1 Entidades y atributos

| Entidad | Atributos | Clave candidata |
|---------|-----------|-----------------|
| **Empleado** | `id_empleado`, `nombre`, `activo` (booleano, opcional para bajas lógicas) | `id_empleado` |
| **Cliente** | `id_cliente`, `nombre`, `email` (opcional), `telefono` (opcional), `id_empleado` (empleado que habitualmente atiende o registró al cliente) | `id_cliente` |
| **Categoria** | `id_categoria`, `nombre` (tipo de categoría comercial) | `id_categoria` |
| **Proveedor** | `id_proveedor`, `nombre`, `contacto` (opcional) | `id_proveedor` |
| **Producto** | `id_producto`, `nombre`, `precio_venta`, `stock` (unidades disponibles), `activo` | `id_producto` |
| **Compra** | `id_compra`, `fecha`, `id_cliente`, `id_empleado` (quien atendió la venta), `observaciones` (opcional) | `id_compra` |
| **Factura** | `id_factura`, `id_compra` (enlace 1:1 con la compra), `fecha_emision`, `estado` (ej. emitida, anulada) | `id_factura` |
| **Detalle** | `id_detalle`, `id_factura`, `id_producto`, `cantidad`, `precio_unitario` (precio congelado al momento de la venta), `subtotal` | `id_detalle` |
| **Producto_Categoria** | `id_producto`, `id_categoria` | compuesta (`id_producto`, `id_categoria`) |
| **Producto_Proveedor** | `id_producto`, `id_proveedor`, `precio_compra` (último o referencia), `fecha_actualizacion` (opcional) | compuesta (`id_producto`, `id_proveedor`) |


### 1.2 Relaciones y cardinalidades

| Relación | Participación | Cardinalidad |
|----------|----------------|--------------|
| Empleado **atiende** Cliente | Empleado (1) — Cliente (N) | Un empleado puede estar asociado a muchos clientes (`Cliente.id_empleado` → `Empleado`). |
| Cliente **realiza** Compra | Cliente (1) — Compra (N) | Un cliente puede tener muchas compras. |
| Empleado **registra** Compra | Empleado (1) — Compra (N) | Cada compra tiene un empleado responsable de la atención. |
| Compra **genera** Factura | Compra (1) — Factura (0..1 en modelo mínimo 1:1) | **Regla de negocio:** cada compra del sistema genera exactamente una factura (`Factura.id_compra` único). |
| Factura **contiene** Detalle | Factura (1) — Detalle (N) | Una factura tiene varias líneas. |
| Producto **aparece en** Detalle | Producto (1) — Detalle (N) | Un producto puede venderse en muchas líneas. |
| Producto **agrupado en** Categoria | Producto (N) — Categoria (N) | Resuelto por entidad asociativa **Producto_Categoria**. |
| Producto **vendido por** Proveedor | Producto (N) — Proveedor (N) | Resuelto por **Producto_Proveedor** (catálogo de quién provee qué y a qué precio de compra referencial). |

**Salidas de negocio (no como tablas persistidas en este diseño):** “reporte de ventas” y “stock disponible” se obtienen por consultas sobre `Factura`, `Detalle`, `Producto`, etc.

---

## 2. Modelo relacional (esquema documentado)

Clave primaria en **negrita**; claves foráneas indicadas con →.

1. **Empleado** (**id_empleado**, nombre, activo)  
2. **Cliente** (**id_cliente**, nombre, email, telefono, id_empleado*)  
   - *id_empleado* → Empleado.id_empleado  

3. **Categoria** (**id_categoria**, nombre)  

4. **Proveedor** (**id_proveedor**, nombre, contacto)  

5. **Producto** (**id_producto**, nombre, precio_venta, stock, activo)  

6. **Producto_Categoria** (**id_producto**, **id_categoria**)  
   - *id_producto* → Producto.id_producto  
   - *id_categoria* → Categoria.id_categoria  

7. **Producto_Proveedor** (**id_producto**, **id_proveedor**, precio_compra, fecha_actualizacion)  
   - *id_producto* → Producto.id_producto  
   - *id_proveedor* → Proveedor.id_proveedor  

8. **Compra** (**id_compra**, fecha, id_cliente*, id_empleado*, observaciones)  
   - *id_cliente* → Cliente.id_cliente  
   - *id_empleado* → Empleado.id_empleado  

9. **Factura** (**id_factura**, id_compra*, fecha_emision, estado)  
   - *id_compra* → Compra.id_compra (restricción UNIQUE: una factura por compra)  

10. **Detalle** (**id_detalle**, id_factura*, id_producto*, cantidad, precio_unitario, subtotal)  
    - *id_factura* → Factura.id_factura  
    - *id_producto* → Producto.id_producto  

**Integridad referencial:** todas las FK anteriores con `ON DELETE RESTRICT` (o `NO ACTION`) salvo decisión explícita posterior para anulaciones (ej. soft-delete en `Producto`).

---

## 3. Normalización hasta 3FN

### 3.1 Convenciones

- Solo se listan dependencias funcionales **no triviales** relevantes para el argumento.
- Se asume dominio atómico en columnas escalares (sin listas multivaluadas en una celda).

### 3.2 Empleado

- **PK:** `id_empleado`  
- **DFs:** `id_empleado` → `nombre`, `activo`  
- **1FN:** atributos atómicos.  
- **2FN:** no hay atributos no clave en dependencia parcial (PK simple).  
- **3FN:** no hay dependencias transitivas sobre la PK.  
- **Conclusión:** 3FN.

### 3.3 Cliente

- **PK:** `id_cliente`  
- **DFs:** `id_cliente` → `nombre`, `email`, `telefono`, `id_empleado`  
- **1FN / 2FN / 3FN:** igual que arriba (PK simple; `id_empleado` es FK, no hay cadena A→B→C sobre `id_cliente`).  
- **Conclusión:** 3FN.

### 3.4 Categoria, Proveedor, Producto

Misma estructura: PK simple `id_*` determina el resto de atributos no clave del mismo esquema. Sin grupos repetitivos, sin dependencias parciales ni transitivas sobre la PK. **3FN.**

### 3.5 Producto_Categoria

- **PK compuesta:** (`id_producto`, `id_categoria`)  
- **DFs:** la pareja determina la fila; no hay atributos no clave adicionales.  
- **2FN:** no hay atributos no clave.  
- **3FN:** trivialmente cumplida.  
- **Conclusión:** 3FN (tabla de unión pura).

### 3.6 Producto_Proveedor

- **PK compuesta:** (`id_producto`, `id_proveedor`)  
- **DFs:** (`id_producto`, `id_proveedor`) → `precio_compra`, `fecha_actualizacion`  
- **2FN:** `precio_compra` y `fecha_actualizacion` dependen de **toda** la PK compuesta (no solo de `id_producto` ni solo de `id_proveedor`).  
- **3FN:** no hay atributo no clave que determine a otro no clave.  
- **Conclusión:** 3FN.

### 3.7 Compra

- **PK:** `id_compra`  
- **DFs:** `id_compra` → `fecha`, `id_cliente`, `id_empleado`, `observaciones`  
- **1FN–3FN:** análogo a Cliente; las FK no introducen transitividad indebida sobre `id_compra`.  
- **Conclusión:** 3FN.

### 3.8 Factura

- **PK:** `id_factura`  
- **DFs:** `id_factura` → `id_compra`, `fecha_emision`, `estado`  
- **Restricción adicional:** `id_compra` funcionalmente único (1:1 con compra).  
- **3FN:** atributos dependen solo de `id_factura`. No se almacenan datos del cliente en `Factura` (evita redundancia y dependencia transitiva desde `id_factura` hacia datos de cliente vía `id_compra`).  
- **Conclusión:** 3FN.

### 3.9 Detalle

- **PK:** `id_detalle`  
- **DFs:**  
  - `id_detalle` → `id_factura`, `id_producto`, `cantidad`, `precio_unitario`, `subtotal`  
  - Regla de negocio: `subtotal = cantidad * precio_unitario` (puede materializarse con CHECK o generarse en aplicación; si se exige solo por aplicación, la tabla sigue en 3FN si `subtotal` no introduce DF transitiva indebida; lo habitual es CHECK o columna generada documentada).  
- **Importante:** `precio_unitario` se **congela** en la línea para no depender del precio vigente del producto en el tiempo (evita anomalías de actualización).  
- **2FN:** todos los no clave dependen de `id_detalle` entero (PK simple).  
- **3FN:** no hay atributo no clave que determine otro no clave.  

---

## 4. Lista final de tablas y claves foráneas (resumen para DDL)

| Tabla | PK | FK |
|-------|----|----|
| empleado | id_empleado | — |
| cliente | id_cliente | id_empleado → empleado |
| categoria | id_categoria | — |
| proveedor | id_proveedor | — |
| producto | id_producto | — |
| producto_categoria | (id_producto, id_categoria) | id_producto → producto; id_categoria → categoria |
| producto_proveedor | (id_producto, id_proveedor) | id_producto → producto; id_proveedor → proveedor |
| compra | id_compra | id_cliente → cliente; id_empleado → empleado |
| factura | id_factura | id_compra → compra (UNIQUE) |
| detalle | id_detalle | id_factura → factura; id_producto → producto |

---

## 5. Vista e índices (implementación en PostgreSQL)

El archivo [`db/schema.sql`](../db/schema.sql) materializa este diseño con tipos concretos, `NOT NULL`, PK, FK y restricciones `CHECK`.

**Vista `vista_reporte_ventas`:** une `factura`, `compra`, `cliente`, `empleado`, `detalle` y `producto`, filtrando facturas en estado `emitida`, para alimentar reportes de ventas en la aplicación sin duplicar datos en tablas base.

**Índices explícitos (justificación):**

| Índice | Columna(s) | Motivo |
|--------|------------|--------|
| `idx_factura_fecha_emision` | `factura(fecha_emision)` | Consultas por rango de fechas en reportes y listados temporales. |
| `idx_detalle_id_factura` | `detalle(id_factura)` | Acceso por factura al listar líneas y JOIN frecuente `detalle` ↔ `factura`. |
