-- Esquema relacional: tienda (inventario y ventas)
-- Motor objetivo: PostgreSQL 16+

DROP VIEW IF EXISTS vista_reporte_ventas CASCADE;

DROP TABLE IF EXISTS detalle CASCADE;
DROP TABLE IF EXISTS factura CASCADE;
DROP TABLE IF EXISTS compra CASCADE;
DROP TABLE IF EXISTS producto_proveedor CASCADE;
DROP TABLE IF EXISTS producto_categoria CASCADE;
DROP TABLE IF EXISTS cliente CASCADE;
DROP TABLE IF EXISTS producto CASCADE;
DROP TABLE IF EXISTS proveedor CASCADE;
DROP TABLE IF EXISTS categoria CASCADE;
DROP TABLE IF EXISTS empleado CASCADE;

CREATE TABLE empleado (
  id_empleado SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE categoria (
  id_categoria SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL
);

CREATE TABLE proveedor (
  id_proveedor SERIAL PRIMARY KEY,
  nombre VARCHAR(160) NOT NULL,
  contacto VARCHAR(200)
);

CREATE TABLE producto (
  id_producto SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  precio_venta NUMERIC(12, 2) NOT NULL CHECK (precio_venta >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE cliente (
  id_cliente SERIAL PRIMARY KEY,
  nombre VARCHAR(160) NOT NULL,
  email VARCHAR(180),
  telefono VARCHAR(40),
  id_empleado INTEGER NOT NULL,
  CONSTRAINT fk_cliente_empleado FOREIGN KEY (id_empleado)
    REFERENCES empleado (id_empleado) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE producto_categoria (
  id_producto INTEGER NOT NULL,
  id_categoria INTEGER NOT NULL,
  PRIMARY KEY (id_producto, id_categoria),
  CONSTRAINT fk_pc_producto FOREIGN KEY (id_producto)
    REFERENCES producto (id_producto) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_pc_categoria FOREIGN KEY (id_categoria)
    REFERENCES categoria (id_categoria) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE producto_proveedor (
  id_producto INTEGER NOT NULL,
  id_proveedor INTEGER NOT NULL,
  precio_compra NUMERIC(12, 2) NOT NULL CHECK (precio_compra >= 0),
  fecha_actualizacion DATE,
  PRIMARY KEY (id_producto, id_proveedor),
  CONSTRAINT fk_pp_producto FOREIGN KEY (id_producto)
    REFERENCES producto (id_producto) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_pp_proveedor FOREIGN KEY (id_proveedor)
    REFERENCES proveedor (id_proveedor) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE compra (
  id_compra SERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  id_cliente INTEGER NOT NULL,
  id_empleado INTEGER NOT NULL,
  observaciones VARCHAR(500),
  CONSTRAINT fk_compra_cliente FOREIGN KEY (id_cliente)
    REFERENCES cliente (id_cliente) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_compra_empleado FOREIGN KEY (id_empleado)
    REFERENCES empleado (id_empleado) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE factura (
  id_factura SERIAL PRIMARY KEY,
  id_compra INTEGER NOT NULL,
  fecha_emision DATE NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'emitida'
    CHECK (estado IN ('emitida', 'anulada')),
  CONSTRAINT fk_factura_compra FOREIGN KEY (id_compra)
    REFERENCES compra (id_compra) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT uq_factura_compra UNIQUE (id_compra)
);

CREATE TABLE detalle (
  id_detalle SERIAL PRIMARY KEY,
  id_factura INTEGER NOT NULL,
  id_producto INTEGER NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(12, 2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
  CONSTRAINT fk_detalle_factura FOREIGN KEY (id_factura)
    REFERENCES factura (id_factura) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_detalle_producto FOREIGN KEY (id_producto)
    REFERENCES producto (id_producto) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_detalle_subtotal CHECK (subtotal = cantidad * precio_unitario)
);

-- Vista consumida por el backend para listados de ventas (líneas con contexto de cliente y empleado).
CREATE VIEW vista_reporte_ventas AS
SELECT
  f.id_factura,
  f.fecha_emision,
  f.estado AS estado_factura,
  c.id_compra,
  c.fecha AS fecha_compra,
  cl.id_cliente,
  cl.nombre AS cliente_nombre,
  e.id_empleado,
  e.nombre AS empleado_nombre,
  d.id_detalle,
  p.id_producto,
  p.nombre AS producto_nombre,
  d.cantidad,
  d.precio_unitario,
  d.subtotal
FROM factura f
INNER JOIN compra c ON c.id_compra = f.id_compra
INNER JOIN cliente cl ON cl.id_cliente = c.id_cliente
INNER JOIN empleado e ON e.id_empleado = c.id_empleado
INNER JOIN detalle d ON d.id_factura = f.id_factura
INNER JOIN producto p ON p.id_producto = d.id_producto
WHERE f.estado = 'emitida';

-- Índice en fecha_emision: filtros por rango en reportes y dashboards.
CREATE INDEX idx_factura_fecha_emision ON factura (fecha_emision);

-- Índice en id_factura en detalle: JOIN detalle↔factura y agregaciones por factura.
CREATE INDEX idx_detalle_id_factura ON detalle (id_factura);
