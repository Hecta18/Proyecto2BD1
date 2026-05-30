-- Stored procedures (PostgreSQL) — operaciones críticas de negocio

-- 1) Registrar venta con transacción explícita y ROLLBACK ante error
CREATE OR REPLACE PROCEDURE sp_registrar_venta(
  IN p_id_cliente INTEGER,
  IN p_id_empleado INTEGER,
  IN p_fecha DATE,
  IN p_observaciones VARCHAR(500),
  IN p_lineas JSONB,
  OUT p_id_compra INTEGER,
  OUT p_id_factura INTEGER
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_linea JSONB;
  v_id_producto INTEGER;
  v_cantidad INTEGER;
  v_precio NUMERIC(12, 2);
  v_stock INTEGER;
  v_activo BOOLEAN;
BEGIN
  IF p_lineas IS NULL OR jsonb_array_length(p_lineas) = 0 THEN
    RAISE EXCEPTION 'Debe incluir al menos una línea de producto';
  END IF;

  INSERT INTO compra (fecha, id_cliente, id_empleado, observaciones)
  VALUES (p_fecha, p_id_cliente, p_id_empleado, p_observaciones)
  RETURNING id_compra INTO p_id_compra;

  INSERT INTO factura (id_compra, fecha_emision, estado)
  VALUES (p_id_compra, p_fecha, 'emitida')
  RETURNING id_factura INTO p_id_factura;

  FOR v_linea IN SELECT value FROM jsonb_array_elements(p_lineas) LOOP
    v_id_producto := (v_linea->>'id_producto')::INTEGER;
    v_cantidad := (v_linea->>'cantidad')::INTEGER;

    IF v_cantidad IS NULL OR v_cantidad < 1 THEN
      RAISE EXCEPTION 'Cantidad inválida para producto %', v_id_producto;
    END IF;

    SELECT precio_venta, stock, activo
    INTO v_precio, v_stock, v_activo
    FROM producto
    WHERE id_producto = v_id_producto
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto % no existe', v_id_producto;
    END IF;
    IF NOT v_activo THEN
      RAISE EXCEPTION 'Producto % está inactivo', v_id_producto;
    END IF;
    IF v_stock < v_cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente para producto % (disponible %, solicitado %)',
        v_id_producto, v_stock, v_cantidad;
    END IF;

    INSERT INTO detalle (id_factura, id_producto, cantidad, precio_unitario, subtotal)
    VALUES (p_id_factura, v_id_producto, v_cantidad, v_precio, v_cantidad * v_precio);

    UPDATE producto SET stock = stock - v_cantidad WHERE id_producto = v_id_producto;
  END LOOP;

EXCEPTION
  WHEN OTHERS THEN
    ROLLBACK;
    RAISE;
END;
$$;

-- 2) Ajustar stock de inventario
CREATE OR REPLACE PROCEDURE sp_ajustar_stock(
  IN p_id_producto INTEGER,
  IN p_delta INTEGER,
  IN p_motivo VARCHAR(200),
  OUT p_stock_resultante INTEGER
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_stock INTEGER;
BEGIN
  IF p_delta = 0 THEN
    RAISE EXCEPTION 'El ajuste debe ser distinto de cero';
  END IF;

  SELECT stock INTO v_stock FROM producto WHERE id_producto = p_id_producto FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto % no encontrado', p_id_producto;
  END IF;

  IF v_stock + p_delta < 0 THEN
    RAISE EXCEPTION 'El ajuste dejaría stock negativo (actual %, delta %)', v_stock, p_delta;
  END IF;

  UPDATE producto SET stock = stock + p_delta WHERE id_producto = p_id_producto
  RETURNING stock INTO p_stock_resultante;
END;
$$;

-- 3) Desactivar producto (baja lógica)
CREATE OR REPLACE PROCEDURE sp_desactivar_producto(
  IN p_id_producto INTEGER,
  OUT p_mensaje TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE producto SET activo = FALSE WHERE id_producto = p_id_producto;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto % no encontrado', p_id_producto;
  END IF;
  p_mensaje := 'Producto desactivado correctamente';
END;
$$;

-- 4) Totales de ventas por periodo — parámetros IN/OUT y manejo de excepciones
CREATE OR REPLACE PROCEDURE sp_obtener_totales_periodo(
  IN p_fecha_inicio DATE,
  IN p_fecha_fin DATE,
  OUT p_total NUMERIC(12, 2),
  OUT p_num_facturas BIGINT,
  OUT p_mensaje TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  p_total := 0;
  p_num_facturas := 0;
  p_mensaje := 'OK';

  IF p_fecha_inicio IS NULL OR p_fecha_fin IS NULL THEN
    RAISE EXCEPTION 'Las fechas de inicio y fin son obligatorias';
  END IF;
  IF p_fecha_fin < p_fecha_inicio THEN
    RAISE EXCEPTION 'La fecha fin (%) no puede ser anterior a la fecha inicio (%)',
      p_fecha_fin, p_fecha_inicio;
  END IF;

  SELECT COALESCE(SUM(d.subtotal), 0)::NUMERIC(12, 2),
         COUNT(DISTINCT f.id_factura)::BIGINT
  INTO p_total, p_num_facturas
  FROM factura f
  INNER JOIN detalle d ON d.id_factura = f.id_factura
  WHERE f.estado = 'emitida'
    AND f.fecha_emision BETWEEN p_fecha_inicio AND p_fecha_fin;

  p_mensaje := format('Totales calculados del %s al %s', p_fecha_inicio, p_fecha_fin);

EXCEPTION
  WHEN OTHERS THEN
    p_total := 0;
    p_num_facturas := 0;
    p_mensaje := SQLERRM;
    RAISE;
END;
$$;

-- Invocador desde Node.js para leer parámetros OUT del procedimiento anterior
CREATE OR REPLACE FUNCTION fn_invocar_totales_periodo(
  p_fecha_inicio DATE,
  p_fecha_fin DATE
)
RETURNS TABLE(total NUMERIC(12, 2), num_facturas BIGINT, mensaje TEXT)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC(12, 2);
  v_num BIGINT;
  v_msg TEXT;
BEGIN
  CALL sp_obtener_totales_periodo(p_fecha_inicio, p_fecha_fin, v_total, v_num, v_msg);
  RETURN QUERY SELECT v_total, v_num, v_msg;
END;
$$;

-- Invocador para sp_registrar_venta (lectura de OUT desde el backend)
CREATE OR REPLACE FUNCTION fn_registrar_venta(
  p_id_cliente INTEGER,
  p_id_empleado INTEGER,
  p_fecha DATE,
  p_observaciones VARCHAR(500),
  p_lineas JSONB
)
RETURNS TABLE(id_compra INTEGER, id_factura INTEGER)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_compra INTEGER;
  v_factura INTEGER;
BEGIN
  CALL sp_registrar_venta(
    p_id_cliente, p_id_empleado, p_fecha, p_observaciones, p_lineas,
    v_compra, v_factura
  );
  RETURN QUERY SELECT v_compra, v_factura;
END;
$$;

-- 5) Anular factura emitida
CREATE OR REPLACE PROCEDURE sp_anular_factura(
  IN p_id_factura INTEGER,
  OUT p_mensaje TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_estado VARCHAR(20);
BEGIN
  SELECT estado INTO v_estado FROM factura WHERE id_factura = p_id_factura FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura % no encontrada', p_id_factura;
  END IF;
  IF v_estado = 'anulada' THEN
    RAISE EXCEPTION 'La factura % ya está anulada', p_id_factura;
  END IF;

  UPDATE factura SET estado = 'anulada' WHERE id_factura = p_id_factura;
  p_mensaje := format('Factura % anulada', p_id_factura);
END;
$$;

-- Permisos de ejecución por rol
GRANT EXECUTE ON PROCEDURE sp_registrar_venta(INTEGER, INTEGER, DATE, VARCHAR, JSONB) TO rol_administrador, rol_gerente_tienda, rol_vendedor;
GRANT EXECUTE ON FUNCTION fn_registrar_venta(INTEGER, INTEGER, DATE, VARCHAR, JSONB) TO rol_administrador, rol_gerente_tienda, rol_vendedor;
GRANT EXECUTE ON PROCEDURE sp_ajustar_stock(INTEGER, INTEGER, VARCHAR) TO rol_administrador, rol_almacenista;
GRANT EXECUTE ON PROCEDURE sp_desactivar_producto(INTEGER) TO rol_administrador, rol_almacenista;
GRANT EXECUTE ON PROCEDURE sp_obtener_totales_periodo(DATE, DATE) TO rol_administrador, rol_gerente_tienda, rol_auditor;
GRANT EXECUTE ON FUNCTION fn_invocar_totales_periodo(DATE, DATE) TO rol_administrador, rol_gerente_tienda, rol_auditor;
GRANT EXECUTE ON PROCEDURE sp_anular_factura(INTEGER) TO rol_administrador, rol_gerente_tienda;

REVOKE EXECUTE ON PROCEDURE sp_registrar_venta(INTEGER, INTEGER, DATE, VARCHAR, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_registrar_venta(INTEGER, INTEGER, DATE, VARCHAR, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON PROCEDURE sp_ajustar_stock(INTEGER, INTEGER, VARCHAR) FROM PUBLIC;
REVOKE EXECUTE ON PROCEDURE sp_desactivar_producto(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON PROCEDURE sp_obtener_totales_periodo(DATE, DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_invocar_totales_periodo(DATE, DATE) FROM PUBLIC;
REVOKE EXECUTE ON PROCEDURE sp_anular_factura(INTEGER) FROM PUBLIC;
