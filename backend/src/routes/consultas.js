/**
 * Consultas SQL explícitas expuestas como JSON para la UI.
 */

export async function consultasRoutes(fastify, opts) {
  const { pool } = opts;

  /** JOIN múltiple: factura, compra, cliente, empleado. */
  fastify.get('/api/consultas/join-resumen-facturas', async (_request, reply) => {
    const sql = `
      SELECT
        f.id_factura,
        f.fecha_emision,
        c.id_compra,
        c.fecha AS fecha_compra,
        cl.id_cliente,
        cl.nombre AS cliente_nombre,
        e.id_empleado,
        e.nombre AS empleado_nombre
      FROM factura f
      INNER JOIN compra c ON c.id_compra = f.id_compra
      INNER JOIN cliente cl ON cl.id_cliente = c.id_cliente
      INNER JOIN empleado e ON e.id_empleado = c.id_empleado
      WHERE f.estado = 'emitida'
      ORDER BY f.fecha_emision DESC, f.id_factura
    `;
    const { rows } = await pool.query(sql);
    return reply.send({ consulta: 'join-resumen-facturas', data: rows });
  });

  /** JOIN múltiple: producto, categoría (puente), proveedor (puente). */
  fastify.get('/api/consultas/join-producto-categoria-proveedor', async (_request, reply) => {
    const sql = `
      SELECT DISTINCT
        p.id_producto,
        p.nombre AS producto_nombre,
        p.precio_venta,
        p.stock,
        c.id_categoria,
        c.nombre AS categoria_nombre,
        pr.id_proveedor,
        pr.nombre AS proveedor_nombre,
        pp.precio_compra
      FROM producto p
      INNER JOIN producto_categoria pc ON pc.id_producto = p.id_producto
      INNER JOIN categoria c ON c.id_categoria = pc.id_categoria
      INNER JOIN producto_proveedor pp ON pp.id_producto = p.id_producto
      INNER JOIN proveedor pr ON pr.id_proveedor = pp.id_proveedor
      WHERE p.activo = TRUE
      ORDER BY p.id_producto, c.nombre, pr.nombre
      LIMIT 300
    `;
    const { rows } = await pool.query(sql);
    return reply.send({ consulta: 'join-producto-categoria-proveedor', data: rows });
  });

  /** JOIN múltiple: empleado, compra, cliente, factura. */
  fastify.get('/api/consultas/join-atencion-ventas', async (_request, reply) => {
    const sql = `
      SELECT
        e.id_empleado,
        e.nombre AS empleado_nombre,
        cl.id_cliente,
        cl.nombre AS cliente_nombre,
        c.id_compra,
        c.fecha AS fecha_compra,
        f.id_factura,
        f.fecha_emision,
        f.estado
      FROM empleado e
      INNER JOIN compra c ON c.id_empleado = e.id_empleado
      INNER JOIN cliente cl ON cl.id_cliente = c.id_cliente
      INNER JOIN factura f ON f.id_compra = c.id_compra
      ORDER BY c.fecha DESC, f.id_factura
      LIMIT 200
    `;
    const { rows } = await pool.query(sql);
    return reply.send({ consulta: 'join-atencion-ventas', data: rows });
  });

  /** Subconsulta con NOT IN: productos que no aparecen en líneas de facturas emitidas. */
  fastify.get('/api/consultas/subquery-productos-sin-venta', async (_request, reply) => {
    const sql = `
      SELECT
        p.id_producto,
        p.nombre,
        p.precio_venta,
        p.stock
      FROM producto p
      WHERE p.activo = TRUE
        AND p.id_producto NOT IN (
          SELECT DISTINCT d.id_producto
          FROM detalle d
          INNER JOIN factura f ON f.id_factura = d.id_factura
          WHERE f.estado = 'emitida'
        )
      ORDER BY p.id_producto
    `;
    const { rows } = await pool.query(sql);
    return reply.send({ consulta: 'subquery-productos-sin-venta (NOT IN)', data: rows });
  });

  /** Subconsulta derivada en FROM: clientes con número de compras y última fecha. */
  fastify.get('/api/consultas/subquery-clientes-desde-from', async (_request, reply) => {
    const sql = `
      SELECT sc.id_cliente, sc.nombre, sc.num_compras, sc.ultima_fecha
      FROM (
        SELECT
          c.id_cliente,
          cl.nombre,
          COUNT(*)::bigint AS num_compras,
          MAX(c.fecha) AS ultima_fecha
        FROM compra c
        INNER JOIN cliente cl ON cl.id_cliente = c.id_cliente
        GROUP BY c.id_cliente, cl.nombre
      ) AS sc
      ORDER BY sc.num_compras DESC, sc.id_cliente
    `;
    const { rows } = await pool.query(sql);
    return reply.send({ consulta: 'subquery-clientes-desde-from (subconsulta en FROM)', data: rows });
  });

  /** Subconsulta correlacionada con EXISTS: empleados que tienen al menos una compra registrada. */
  fastify.get('/api/consultas/subquery-empleados-con-ventas', async (_request, reply) => {
    const sql = `
      SELECT
        e.id_empleado,
        e.nombre,
        e.activo
      FROM empleado e
      WHERE EXISTS (
        SELECT 1
        FROM compra c
        WHERE c.id_empleado = e.id_empleado
      )
      ORDER BY e.id_empleado
    `;
    const { rows } = await pool.query(sql);
    return reply.send({ consulta: 'subquery-empleados-con-ventas (EXISTS)', data: rows });
  });

  /** GROUP BY, HAVING y agregación: categorías con ventas totales por encima de umbral. */
  fastify.get('/api/consultas/agregados-ventas-por-categoria', async (request, reply) => {
    const minTotal = Number(request.query.minTotal ?? 15);
    const sql = `
      SELECT
        c.id_categoria,
        c.nombre AS categoria,
        SUM(d.subtotal)::numeric(12,2) AS total_vendido,
        COUNT(DISTINCT d.id_factura) AS num_facturas,
        SUM(d.cantidad)::bigint AS unidades_vendidas
      FROM detalle d
      INNER JOIN factura f ON f.id_factura = d.id_factura
      INNER JOIN producto p ON p.id_producto = d.id_producto
      INNER JOIN producto_categoria pc ON pc.id_producto = p.id_producto
      INNER JOIN categoria c ON c.id_categoria = pc.id_categoria
      WHERE f.estado = 'emitida'
      GROUP BY c.id_categoria, c.nombre
      HAVING SUM(d.subtotal) > $1::numeric
      ORDER BY total_vendido DESC
    `;
    const { rows } = await pool.query(sql, [minTotal]);
    return reply.send({
      consulta: 'agregados-ventas-por-categoria (GROUP BY / HAVING)',
      parametros: { minTotal },
      data: rows,
    });
  });

  /** CTE (WITH): totales por mes y acumulado. */
  fastify.get('/api/consultas/cte-ventas-mensuales', async (_request, reply) => {
    const sql = `
      WITH totales_mes AS (
        SELECT
          date_trunc('month', f.fecha_emision::timestamp)::date AS mes,
          SUM(d.subtotal)::numeric(12,2) AS total_mes
        FROM factura f
        INNER JOIN detalle d ON d.id_factura = f.id_factura
        WHERE f.estado = 'emitida'
        GROUP BY date_trunc('month', f.fecha_emision::timestamp)
      )
      SELECT
        mes,
        total_mes,
        SUM(total_mes) OVER (ORDER BY mes)::numeric(12,2) AS acumulado
      FROM totales_mes
      ORDER BY mes
    `;
    const { rows } = await pool.query(sql);
    return reply.send({ consulta: 'cte-ventas-mensuales (WITH)', data: rows });
  });

  /** Lectura desde la vista definida en el DDL (consumo por backend → UI). */
  fastify.get('/api/reportes/vista-ventas', async (_request, reply) => {
    const sql = `
      SELECT
        id_factura,
        fecha_emision,
        estado_factura,
        id_compra,
        fecha_compra,
        id_cliente,
        cliente_nombre,
        id_empleado,
        empleado_nombre,
        id_detalle,
        id_producto,
        producto_nombre,
        cantidad,
        precio_unitario,
        subtotal
      FROM vista_reporte_ventas
      ORDER BY fecha_emision DESC, id_factura, id_detalle
      LIMIT 500
    `;
    const { rows } = await pool.query(sql);
    return reply.send({ consulta: 'vista_reporte_ventas', data: rows });
  });
}
