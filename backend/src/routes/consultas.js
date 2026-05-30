import { withDbRole } from '../db.js';

export async function consultasRoutes(fastify) {
  const auth = [fastify.requireAuth, fastify.requirePermission('consultas')];

  fastify.get('/api/consultas/join-resumen-facturas', { preHandler: auth }, async (request, reply) => {
    const rol = request.session.user.rol_db;
    const rows = await withDbRole(rol, (client) =>
      client.query(`
        SELECT f.id_factura, f.fecha_emision, c.id_compra, c.fecha AS fecha_compra,
               cl.id_cliente, cl.nombre AS cliente_nombre, e.id_empleado, e.nombre AS empleado_nombre
        FROM factura f
        INNER JOIN compra c ON c.id_compra = f.id_compra
        INNER JOIN cliente cl ON cl.id_cliente = c.id_cliente
        INNER JOIN empleado e ON e.id_empleado = c.id_empleado
        WHERE f.estado = 'emitida'
        ORDER BY f.fecha_emision DESC, f.id_factura
      `)
    );
    return reply.send({ consulta: 'join-resumen-facturas', data: rows.rows });
  });

  fastify.get('/api/consultas/join-producto-categoria-proveedor', { preHandler: auth }, async (request, reply) => {
    const rol = request.session.user.rol_db;
    const rows = await withDbRole(rol, (client) =>
      client.query(`
        SELECT DISTINCT p.id_producto, p.nombre AS producto_nombre, p.precio_venta, p.stock,
               c.id_categoria, c.nombre AS categoria_nombre, pr.id_proveedor, pr.nombre AS proveedor_nombre,
               pp.precio_compra
        FROM producto p
        INNER JOIN producto_categoria pc ON pc.id_producto = p.id_producto
        INNER JOIN categoria c ON c.id_categoria = pc.id_categoria
        INNER JOIN producto_proveedor pp ON pp.id_producto = p.id_producto
        INNER JOIN proveedor pr ON pr.id_proveedor = pp.id_proveedor
        WHERE p.activo = TRUE
        ORDER BY p.id_producto, c.nombre, pr.nombre
        LIMIT 300
      `)
    );
    return reply.send({ consulta: 'join-producto-categoria-proveedor', data: rows.rows });
  });

  fastify.get('/api/consultas/join-atencion-ventas', { preHandler: auth }, async (request, reply) => {
    const rol = request.session.user.rol_db;
    const rows = await withDbRole(rol, (client) =>
      client.query(`
        SELECT e.id_empleado, e.nombre AS empleado_nombre, cl.id_cliente, cl.nombre AS cliente_nombre,
               c.id_compra, c.fecha AS fecha_compra, f.id_factura, f.fecha_emision, f.estado
        FROM empleado e
        INNER JOIN compra c ON c.id_empleado = e.id_empleado
        INNER JOIN cliente cl ON cl.id_cliente = c.id_cliente
        INNER JOIN factura f ON f.id_compra = c.id_compra
        ORDER BY c.fecha DESC, f.id_factura
        LIMIT 200
      `)
    );
    return reply.send({ consulta: 'join-atencion-ventas', data: rows.rows });
  });

  fastify.get('/api/consultas/subquery-productos-sin-venta', { preHandler: auth }, async (request, reply) => {
    const rol = request.session.user.rol_db;
    const rows = await withDbRole(rol, (client) =>
      client.query(`
        SELECT p.id_producto, p.nombre, p.precio_venta, p.stock
        FROM producto p
        WHERE p.activo = TRUE
          AND p.id_producto NOT IN (
            SELECT DISTINCT d.id_producto FROM detalle d
            INNER JOIN factura f ON f.id_factura = d.id_factura
            WHERE f.estado = 'emitida'
          )
        ORDER BY p.id_producto
      `)
    );
    return reply.send({ consulta: 'subquery-productos-sin-venta (NOT IN)', data: rows.rows });
  });

  fastify.get('/api/consultas/subquery-clientes-desde-from', { preHandler: auth }, async (request, reply) => {
    const rol = request.session.user.rol_db;
    const rows = await withDbRole(rol, (client) =>
      client.query(`
        SELECT sc.id_cliente, sc.nombre, sc.num_compras, sc.ultima_fecha
        FROM (
          SELECT c.id_cliente, cl.nombre, COUNT(*)::bigint AS num_compras, MAX(c.fecha) AS ultima_fecha
          FROM compra c
          INNER JOIN cliente cl ON cl.id_cliente = c.id_cliente
          GROUP BY c.id_cliente, cl.nombre
        ) AS sc
        ORDER BY sc.num_compras DESC, sc.id_cliente
      `)
    );
    return reply.send({ consulta: 'subquery-clientes-desde-from (subconsulta en FROM)', data: rows.rows });
  });

  fastify.get('/api/consultas/subquery-empleados-con-ventas', { preHandler: auth }, async (request, reply) => {
    const rol = request.session.user.rol_db;
    const rows = await withDbRole(rol, (client) =>
      client.query(`
        SELECT e.id_empleado, e.nombre, e.activo
        FROM empleado e
        WHERE EXISTS (SELECT 1 FROM compra c WHERE c.id_empleado = e.id_empleado)
        ORDER BY e.id_empleado
      `)
    );
    return reply.send({ consulta: 'subquery-empleados-con-ventas (EXISTS)', data: rows.rows });
  });

  fastify.get('/api/consultas/agregados-ventas-por-categoria', { preHandler: auth }, async (request, reply) => {
    const minTotal = Number(request.query.minTotal ?? 15);
    const rol = request.session.user.rol_db;
    const rows = await withDbRole(rol, (client) =>
      client.query(
        `
        SELECT c.id_categoria, c.nombre AS categoria,
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
      `,
        [minTotal]
      )
    );
    return reply.send({
      consulta: 'agregados-ventas-por-categoria (GROUP BY / HAVING)',
      parametros: { minTotal },
      data: rows.rows,
    });
  });

  fastify.get('/api/consultas/cte-ventas-mensuales', { preHandler: auth }, async (request, reply) => {
    const rol = request.session.user.rol_db;
    const rows = await withDbRole(rol, (client) =>
      client.query(`
        WITH totales_mes AS (
          SELECT date_trunc('month', f.fecha_emision::timestamp)::date AS mes,
                 SUM(d.subtotal)::numeric(12,2) AS total_mes
          FROM factura f
          INNER JOIN detalle d ON d.id_factura = f.id_factura
          WHERE f.estado = 'emitida'
          GROUP BY date_trunc('month', f.fecha_emision::timestamp)
        )
        SELECT mes, total_mes, SUM(total_mes) OVER (ORDER BY mes)::numeric(12,2) AS acumulado
        FROM totales_mes
        ORDER BY mes
      `)
    );
    return reply.send({ consulta: 'cte-ventas-mensuales (WITH)', data: rows.rows });
  });

  fastify.get(
    '/api/reportes/vista-ventas',
    { preHandler: [fastify.requireAuth, fastify.requirePermission('reporte')] },
    async (request, reply) => {
      const rol = request.session.user.rol_db;
      const rows = await withDbRole(rol, (client) =>
        client.query(`
          SELECT id_factura, fecha_emision, estado_factura, id_compra, fecha_compra,
                 id_cliente, cliente_nombre, id_empleado, empleado_nombre,
                 id_detalle, id_producto, producto_nombre, cantidad, precio_unitario, subtotal
          FROM vista_reporte_ventas
          ORDER BY fecha_emision DESC, id_factura, id_detalle
          LIMIT 500
        `)
      );
      return reply.send({ consulta: 'vista_reporte_ventas', data: rows.rows });
    }
  );

  /** Stored procedure sp_obtener_totales_periodo (IN/OUT + excepciones) */
  fastify.get(
    '/api/reportes/totales-periodo',
    { preHandler: [fastify.requireAuth, fastify.requirePermission('totales_periodo')] },
    async (request, reply) => {
      const inicio = request.query.inicio;
      const fin = request.query.fin;
      if (!inicio || !fin) {
        return reply.code(400).send({ error: 'Parámetros inicio y fin (YYYY-MM-DD) son obligatorios' });
      }
      const rol = request.session.user.rol_db;
      try {
        const rows = await withDbRole(rol, (client) =>
          client.query(`SELECT * FROM fn_invocar_totales_periodo($1::date, $2::date)`, [inicio, fin])
        );
        return reply.send({
          procedimiento: 'sp_obtener_totales_periodo',
          data: rows.rows[0] ?? null,
        });
      } catch (err) {
        return reply.code(400).send({ error: err.message, procedimiento: 'sp_obtener_totales_periodo' });
      }
    }
  );

  /** Stored procedure sp_anular_factura */
  fastify.post(
    '/api/facturas/:id/anular',
    { preHandler: [fastify.requireAuth, fastify.requirePermission('anular_factura')] },
    async (request, reply) => {
      const id = Number(request.params.id);
      if (!Number.isInteger(id) || id < 1) {
        return reply.code(400).send({ error: 'ID de factura no válido' });
      }
      const rol = request.session.user.rol_db;
      try {
        await withDbRole(rol, (client) => client.query(`CALL sp_anular_factura($1, NULL)`, [id]));
        return reply.send({ mensaje: `Factura ${id} anulada`, procedimiento: 'sp_anular_factura' });
      } catch (err) {
        return reply.code(400).send({ error: err.message });
      }
    }
  );
}
