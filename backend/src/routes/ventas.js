import { withDbRole } from '../db.js';

/** Venta vía stored procedure sp_registrar_venta (transacción con ROLLBACK en el SP). */
export async function ventasRoutes(fastify) {
  fastify.post(
    '/api/ventas',
    { preHandler: [fastify.requireAuth, fastify.requirePermission('venta')] },
    async (request, reply) => {
      const body = request.body ?? {};
      const { id_cliente, id_empleado, fecha, observaciones, lineas } = body;

      const cid = Number(id_cliente);
      const eid = Number(id_empleado);
      if (!Number.isInteger(cid) || cid < 1) {
        return reply.code(400).send({ error: 'id_cliente inválido' });
      }
      if (!Number.isInteger(eid) || eid < 1) {
        return reply.code(400).send({ error: 'id_empleado inválido' });
      }
      if (!Array.isArray(lineas) || lineas.length === 0) {
        return reply.code(400).send({ error: 'lineas debe ser un arreglo no vacío' });
      }

      const fechaCompra =
        typeof fecha === 'string' && fecha.length > 0 ? fecha : new Date().toISOString().slice(0, 10);
      const obs =
        observaciones === undefined || observaciones === '' ? null : String(observaciones).slice(0, 500);

      const lineasJson = lineas.map((l) => ({
        id_producto: Number(l.id_producto),
        cantidad: Number(l.cantidad),
      }));
      for (const l of lineasJson) {
        if (!Number.isInteger(l.id_producto) || l.id_producto < 1) {
          return reply.code(400).send({ error: 'Cada línea requiere id_producto válido' });
        }
        if (!Number.isInteger(l.cantidad) || l.cantidad < 1) {
          return reply.code(400).send({ error: 'Cada línea requiere cantidad entera positiva' });
        }
      }

      const rol = request.session.user.rol_db;
      try {
        const rows = await withDbRole(rol, async (client) => {
          const res = await client.query(
            `SELECT id_compra, id_factura
             FROM fn_registrar_venta($1, $2, $3::date, $4, $5::jsonb)`,
            [cid, eid, fechaCompra, obs, JSON.stringify(lineasJson)]
          );
          return res.rows;
        });
        const row = rows[0];
        return reply.code(201).send({
          data: {
            id_compra: row.id_compra,
            id_factura: row.id_factura,
            mensaje: 'Venta registrada correctamente',
            procedimiento: 'sp_registrar_venta',
          },
        });
      } catch (err) {
        const code = err.code === '42501' ? 403 : 400;
        return reply.code(code).send({
          error: err.message || 'Error al registrar la venta',
          rollback: true,
          procedimiento: 'sp_registrar_venta',
        });
      }
    }
  );
}
