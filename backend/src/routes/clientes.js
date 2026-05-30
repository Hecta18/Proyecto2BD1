import { withPrismaRole } from '../prisma.js';

export async function clientesRoutes(fastify) {
  fastify.get(
    '/api/clientes',
    { preHandler: [fastify.requireAuth, fastify.requirePermission('clientes_read')] },
    async (request, reply) => {
      const rol = request.session.user.rol_db;
      const data = await withPrismaRole(rol, (tx) =>
        tx.cliente.findMany({
          orderBy: { id_cliente: 'asc' },
          include: { empleado: { select: { nombre: true } } },
        })
      );
      return reply.send({
        data: data.map((c) => ({
          id_cliente: c.id_cliente,
          nombre: c.nombre,
          email: c.email,
          telefono: c.telefono,
          id_empleado: c.id_empleado,
          empleado_nombre: c.empleado.nombre,
        })),
      });
    }
  );

  fastify.get(
    '/api/clientes/:id',
    { preHandler: [fastify.requireAuth, fastify.requirePermission('clientes_read')] },
    async (request, reply) => {
      const id = Number(request.params.id);
      if (!Number.isInteger(id) || id < 1) {
        return reply.code(400).send({ error: 'Identificador de cliente no válido' });
      }
      const rol = request.session.user.rol_db;
      const c = await withPrismaRole(rol, (tx) =>
        tx.cliente.findUnique({
          where: { id_cliente: id },
          include: { empleado: { select: { nombre: true } } },
        })
      );
      if (!c) {
        return reply.code(404).send({ error: 'Cliente no encontrado' });
      }
      return reply.send({
        data: {
          id_cliente: c.id_cliente,
          nombre: c.nombre,
          email: c.email,
          telefono: c.telefono,
          id_empleado: c.id_empleado,
          empleado_nombre: c.empleado.nombre,
        },
      });
    }
  );

  /** CRUD vía ORM (Prisma): crear cliente */
  fastify.post(
    '/api/clientes',
    { preHandler: [fastify.requireAuth, fastify.requirePermission('clientes_write')] },
    async (request, reply) => {
      const { nombre, email, telefono, id_empleado } = request.body ?? {};
      if (!nombre || typeof nombre !== 'string' || nombre.trim() === '') {
        return reply.code(400).send({ error: 'El nombre es obligatorio' });
      }
      const emp = Number(id_empleado);
      if (!Number.isInteger(emp) || emp < 1) {
        return reply.code(400).send({ error: 'id_empleado es obligatorio y debe ser un entero válido' });
      }
      const rol = request.session.user.rol_db;
      const created = await withPrismaRole(rol, (tx) =>
        tx.cliente.create({
          data: {
            nombre: nombre.trim(),
            email: email ?? null,
            telefono: telefono ?? null,
            id_empleado: emp,
          },
        })
      );
      return reply.code(201).send({ data: created });
    }
  );

  /** CRUD vía ORM (Prisma): actualizar cliente */
  fastify.put(
    '/api/clientes/:id',
    { preHandler: [fastify.requireAuth, fastify.requirePermission('clientes_write')] },
    async (request, reply) => {
      const id = Number(request.params.id);
      if (!Number.isInteger(id) || id < 1) {
        return reply.code(400).send({ error: 'Identificador de cliente no válido' });
      }
      const { nombre, email, telefono, id_empleado } = request.body ?? {};
      const data = {};
      if (nombre !== undefined) {
        if (typeof nombre !== 'string' || nombre.trim() === '') {
          return reply.code(400).send({ error: 'nombre no puede estar vacío' });
        }
        data.nombre = nombre.trim();
      }
      if (email !== undefined) data.email = email === '' ? null : email;
      if (telefono !== undefined) data.telefono = telefono === '' ? null : telefono;
      if (id_empleado !== undefined) {
        const emp = Number(id_empleado);
        if (!Number.isInteger(emp) || emp < 1) {
          return reply.code(400).send({ error: 'id_empleado inválido' });
        }
        data.id_empleado = emp;
      }
      if (Object.keys(data).length === 0) {
        return reply.code(400).send({ error: 'No hay campos para actualizar' });
      }
      const rol = request.session.user.rol_db;
      try {
        const updated = await withPrismaRole(rol, (tx) =>
          tx.cliente.update({ where: { id_cliente: id }, data })
        );
        return reply.send({ data: updated });
      } catch {
        return reply.code(404).send({ error: 'Cliente no encontrado' });
      }
    }
  );

  fastify.delete(
    '/api/clientes/:id',
    { preHandler: [fastify.requireAuth, fastify.requirePermission('clientes_write')] },
    async (request, reply) => {
      const id = Number(request.params.id);
      if (!Number.isInteger(id) || id < 1) {
        return reply.code(400).send({ error: 'Identificador de cliente no válido' });
      }
      const rol = request.session.user.rol_db;
      if (rol !== 'rol_administrador') {
        return reply.code(403).send({ error: 'Solo administrador puede eliminar clientes' });
      }
      try {
        await withPrismaRole(rol, (tx) => tx.cliente.delete({ where: { id_cliente: id } }));
        return reply.code(204).send();
      } catch (err) {
        if (err.code === 'P2003') {
          return reply.code(409).send({ error: 'No se puede eliminar: el cliente tiene compras' });
        }
        return reply.code(404).send({ error: 'Cliente no encontrado' });
      }
    }
  );
}
