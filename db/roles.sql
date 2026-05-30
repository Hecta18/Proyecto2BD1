-- Roles de negocio en PostgreSQL (CREATE ROLE + GRANT/REVOKE granular)
-- El usuario de aplicación proy3 puede hacer SET ROLE a cualquiera de estos roles.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_administrador') THEN
    DROP OWNED BY rol_administrador;
    DROP ROLE rol_administrador;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_gerente_tienda') THEN
    DROP OWNED BY rol_gerente_tienda;
    DROP ROLE rol_gerente_tienda;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_vendedor') THEN
    DROP OWNED BY rol_vendedor;
    DROP ROLE rol_vendedor;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_almacenista') THEN
    DROP OWNED BY rol_almacenista;
    DROP ROLE rol_almacenista;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_auditor') THEN
    DROP OWNED BY rol_auditor;
    DROP ROLE rol_auditor;
  END IF;
END $$;

CREATE ROLE rol_administrador NOLOGIN;
CREATE ROLE rol_gerente_tienda NOLOGIN;
CREATE ROLE rol_vendedor NOLOGIN;
CREATE ROLE rol_almacenista NOLOGIN;
CREATE ROLE rol_auditor NOLOGIN;

-- ========== rol_administrador: acceso total de negocio ==========
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rol_administrador;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rol_administrador;

-- ========== rol_gerente_tienda: operación comercial y reportes ==========
GRANT SELECT ON empleado, categoria, proveedor, producto, producto_categoria, producto_proveedor TO rol_gerente_tienda;
GRANT SELECT, INSERT, UPDATE ON cliente TO rol_gerente_tienda;
GRANT SELECT, INSERT, UPDATE ON compra, factura, detalle TO rol_gerente_tienda;
GRANT UPDATE (stock) ON producto TO rol_gerente_tienda;
GRANT UPDATE (estado) ON factura TO rol_gerente_tienda, rol_administrador;
GRANT SELECT ON usuario_app TO rol_gerente_tienda;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rol_gerente_tienda;
REVOKE DELETE ON cliente, compra, factura, detalle, producto FROM rol_gerente_tienda;

-- ========== rol_vendedor: ventas y atención al cliente ==========
GRANT SELECT ON empleado, categoria, proveedor, producto, producto_categoria, producto_proveedor TO rol_vendedor;
GRANT SELECT, INSERT, UPDATE ON cliente TO rol_vendedor;
GRANT SELECT, INSERT ON compra, factura, detalle TO rol_vendedor;
GRANT UPDATE (stock) ON producto TO rol_vendedor;
GRANT SELECT ON usuario_app TO rol_vendedor;
GRANT USAGE, SELECT ON SEQUENCE cliente_id_cliente_seq, compra_id_compra_seq, factura_id_factura_seq, detalle_id_detalle_seq TO rol_vendedor;
REVOKE DELETE ON producto, cliente, compra, factura, detalle FROM rol_vendedor;

-- ========== rol_almacenista: inventario y catálogo ==========
GRANT SELECT ON empleado, categoria, proveedor, cliente, compra, factura, detalle TO rol_almacenista;
GRANT SELECT, INSERT, UPDATE ON producto TO rol_almacenista;
GRANT SELECT, INSERT, UPDATE, DELETE ON producto_categoria, producto_proveedor TO rol_almacenista;
GRANT SELECT ON usuario_app TO rol_almacenista;
GRANT USAGE, SELECT ON SEQUENCE producto_id_producto_seq TO rol_almacenista;
REVOKE DELETE ON producto FROM rol_almacenista;
REVOKE INSERT, UPDATE, DELETE ON compra, factura, detalle, cliente FROM rol_almacenista;

-- ========== rol_auditor: solo lectura ==========
GRANT SELECT ON ALL TABLES IN SCHEMA public TO rol_auditor;
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM rol_auditor;

-- Vista de reportes
GRANT SELECT ON vista_reporte_ventas TO rol_gerente_tienda, rol_vendedor, rol_almacenista, rol_auditor, rol_administrador;

-- proy3 (conexión de la app) puede asumir cualquier rol de negocio
GRANT rol_administrador, rol_gerente_tienda, rol_vendedor, rol_almacenista, rol_auditor TO proy3;

-- Permisos mínimos para bootstrap (usuario_app lo gestiona la app como owner)
GRANT SELECT ON usuario_app TO proy3;
