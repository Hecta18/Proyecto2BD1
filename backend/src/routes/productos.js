import { withPrismaRole } from '../prisma.js';
import { withDbRole } from '../db.js';

export async function productosRoutes(fastify) {
  fastify.get(
    '/api/productos',
    { preHandler: [fastify.requireAuth, fastify.requirePermission('productos_read')] },
    async (request, reply) => {
      const rol = request.session.user.rol_db;
      const data = await withPrismaRole(rol, (tx) =>
        tx.producto.findMany({
          orderBy: { id_producto: 'asc' },
          select: {
            id_producto: true,
            nombre: true,
            precio_venta: true,
            stock: true,
            activo: true,
          },
        })
      );
      return reply.send({
        data: data.map((p) => ({
          ...p,
          precio_venta: Number(p.precio_venta),
        })),
      });
    }
  );

  fastify.get(
    '/api/productos/:id',
    { preHandler: [fastify.requireAuth, fastify.requirePermission('productos_read')] },
    async (request, reply) => {
      const id = Number(request.params.id);
      if (!Number.isInteger(id) || id < 1) {
        return reply.code(400).send({ error: 'Identificador de producto no válido' });
      }
      const rol = request.session.user.rol_db;
      const p = await withPrismaRole(rol, (tx) =>
        tx.producto.findUnique({ where: { id_producto: id } })
      );
      if (!p) {
        return reply.code(404).send({ error: 'Producto no encontrado' });
      }
      return reply.send({
        data: { ...p, precio_venta: Number(p.precio_venta) },
      });
    }
  );

  /** CRUD vía ORM (Prisma): crear producto */
  fastify.post(
    '/api/productos',
    { preHandler: [fastify.requireAuth, fastify.requirePermission('productos_write')] },
    async (request, reply) => {
      const { nombre, precio_venta, stock, activo } = request.body ?? {};
      if (!nombre || typeof nombre !== 'string' || nombre.trim() === '') {
        return reply.code(400).send({ error: 'El nombre es obligatorio' });
      }
      const precio = Number(precio_venta);
      const stk = stock === undefined || stock === null ? 0 : Number(stock);
      const act = activo === undefined ? true : Boolean(activo);
      if (!Number.isFinite(precio) || precio < 0) {
        return reply.code(400).send({ error: 'precio_venta debe ser un número mayor o igual a 0' });
      }
      if (!Number.isInteger(stk) || stk < 0) {
        return reply.code(400).send({ error: 'stock debe ser un entero mayor o igual a 0' });
      }
      const rol = request.session.user.rol_db;
      const created = await withPrismaRole(rol, (tx) =>
        tx.producto.create({
          data: {
            nombre: nombre.trim(),
            precio_venta: precio,
            stock: stk,
            activo: act,
          },
        })
      );
      return reply.code(201).send({
        data: { ...created, precio_venta: Number(created.precio_venta) },
      });
    }
  );

  /** CRUD vía ORM (Prisma): actualizar producto */
  fastify.put(
    '/api/productos/:id',
    { preHandler: [fastify.requireAuth, fastify.requirePermission('productos_write')] },
    async (request, reply) => {
      const id = Number(request.params.id);
      if (!Number.isInteger(id) || id < 1) {
        return reply.code(400).send({ error: 'Identificador de producto no válido' });
      }
      const { nombre, precio_venta, stock, activo } = request.body ?? {};
      const data = {};
      if (nombre !== undefined) {
        if (typeof nombre !== 'string' || nombre.trim() === '') {
          return reply.code(400).send({ error: 'nombre no puede estar vacío' });
        }
        data.nombre = nombre.trim();
      }
      if (precio_venta !== undefined) {
        const precio = Number(precio_venta);
        if (!Number.isFinite(precio) || precio < 0) {
          return reply.code(400).send({ error: 'precio_venta inválido' });
        }
        data.precio_venta = precio;
      }
      if (stock !== undefined) {
        const stk = Number(stock);
        if (!Number.isInteger(stk) || stk < 0) {
          return reply.code(400).send({ error: 'stock inválido' });
        }
        data.stock = stk;
      }
      if (activo !== undefined) {
        data.activo = Boolean(activo);
      }
      if (Object.keys(data).length === 0) {
        return reply.code(400).send({ error: 'No hay campos para actualizar' });
      }
      const rol = request.session.user.rol_db;
      try {
        const updated = await withPrismaRole(rol, (tx) =>
          tx.producto.update({ where: { id_producto: id }, data })
        );
        return reply.send({
          data: { ...updated, precio_venta: Number(updated.precio_venta) },
        });
      } catch {
        return reply.code(404).send({ error: 'Producto no encontrado' });
      }
    }
  );

  /** Stored procedure: sp_desactivar_producto */
  fastify.delete(
    '/api/productos/:id',
    { preHandler: [fastify.requireAuth, fastify.requirePermission('productos_write')] },
    async (request, reply) => {
      const id = Number(request.params.id);
      if (!Number.isInteger(id) || id < 1) {
        return reply.code(400).send({ error: 'Identificador de producto no válido' });
      }
      const rol = request.session.user.rol_db;
      try {
        const rows = await withDbRole(rol, async (client) => {
          const res = await client.query(`CALL sp_desactivar_producto($1, NULL)`, [id]);
          return res.rows;
        });
        const p = await withPrismaRole(rol, (tx) =>
          tx.producto.findUnique({ where: { id_producto: id } })
        );
        return reply.send({
          data: p ? { ...p, precio_venta: Number(p.precio_venta) } : null,
          mensaje: rows[0]?.p_mensaje || 'Producto desactivado',
          procedimiento: 'sp_desactivar_producto',
        });
      } catch (err) {
        const code = err.code === '42501' ? 403 : 400;
        return reply.code(code).send({ error: err.message });
      }
    }
  );

  /** Stored procedure: sp_ajustar_stock */
  fastify.post(
    '/api/productos/:id/ajustar-stock',
    { preHandler: [fastify.requireAuth, fastify.requirePermission('ajustar_stock')] },
    async (request, reply) => {
      const id = Number(request.params.id);
      const delta = Number(request.body?.delta);
      const motivo = request.body?.motivo ? String(request.body.motivo).slice(0, 200) : null;
      if (!Number.isInteger(id) || id < 1) {
        return reply.code(400).send({ error: 'ID de producto no válido' });
      }
      if (!Number.isInteger(delta) || delta === 0) {
        return reply.code(400).send({ error: 'delta debe ser un entero distinto de cero' });
      }
      const rol = request.session.user.rol_db;
      try {
        await withDbRole(rol, async (client) => {
          await client.query(`CALL sp_ajustar_stock($1, $2, $3, NULL)`, [id, delta, motivo]);
        });
        const p = await withPrismaRole(rol, (tx) =>
          tx.producto.findUnique({ where: { id_producto: id } })
        );
        return reply.send({
          data: p ? { ...p, precio_venta: Number(p.precio_venta) } : null,
          procedimiento: 'sp_ajustar_stock',
        });
      } catch (err) {
        return reply.code(400).send({ error: err.message });
      }
    }
  );
}
