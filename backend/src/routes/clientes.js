export async function clientesRoutes(fastify, opts) {
  const { pool } = opts;

  fastify.get('/api/clientes', async (_request, reply) => {
    const { rows } = await pool.query(
      `SELECT c.id_cliente, c.nombre, c.email, c.telefono, c.id_empleado, e.nombre AS empleado_nombre
       FROM cliente c
       INNER JOIN empleado e ON e.id_empleado = c.id_empleado
       ORDER BY c.id_cliente`
    );
    return reply.send({ data: rows });
  });

  fastify.get('/api/clientes/:id', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return reply.code(400).send({ error: 'Identificador de cliente no válido' });
    }
    const { rows } = await pool.query(
      `SELECT c.id_cliente, c.nombre, c.email, c.telefono, c.id_empleado, e.nombre AS empleado_nombre
       FROM cliente c
       INNER JOIN empleado e ON e.id_empleado = c.id_empleado
       WHERE c.id_cliente = $1`,
      [id]
    );
    if (rows.length === 0) {
      return reply.code(404).send({ error: 'Cliente no encontrado' });
    }
    return reply.send({ data: rows[0] });
  });

  fastify.post('/api/clientes', async (request, reply) => {
    const { nombre, email, telefono, id_empleado } = request.body ?? {};
    if (!nombre || typeof nombre !== 'string' || nombre.trim() === '') {
      return reply.code(400).send({ error: 'El nombre es obligatorio' });
    }
    const emp = Number(id_empleado);
    if (!Number.isInteger(emp) || emp < 1) {
      return reply.code(400).send({ error: 'id_empleado es obligatorio y debe ser un entero válido' });
    }
    const { rows } = await pool.query(
      `INSERT INTO cliente (nombre, email, telefono, id_empleado)
       VALUES ($1, $2, $3, $4)
       RETURNING id_cliente, nombre, email, telefono, id_empleado`,
      [nombre.trim(), email ?? null, telefono ?? null, emp]
    );
    return reply.code(201).send({ data: rows[0] });
  });

  fastify.put('/api/clientes/:id', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return reply.code(400).send({ error: 'Identificador de cliente no válido' });
    }
    const { nombre, email, telefono, id_empleado } = request.body ?? {};
    const fields = [];
    const values = [];
    let i = 1;
    if (nombre !== undefined) {
      if (typeof nombre !== 'string' || nombre.trim() === '') {
        return reply.code(400).send({ error: 'nombre no puede estar vacío' });
      }
      fields.push(`nombre = $${i++}`);
      values.push(nombre.trim());
    }
    if (email !== undefined) {
      fields.push(`email = $${i++}`);
      values.push(email === '' ? null : email);
    }
    if (telefono !== undefined) {
      fields.push(`telefono = $${i++}`);
      values.push(telefono === '' ? null : telefono);
    }
    if (id_empleado !== undefined) {
      const emp = Number(id_empleado);
      if (!Number.isInteger(emp) || emp < 1) {
        return reply.code(400).send({ error: 'id_empleado inválido' });
      }
      fields.push(`id_empleado = $${i++}`);
      values.push(emp);
    }
    if (fields.length === 0) {
      return reply.code(400).send({ error: 'No hay campos para actualizar' });
    }
    values.push(id);
    const { rows, rowCount } = await pool.query(
      `UPDATE cliente SET ${fields.join(', ')}
       WHERE id_cliente = $${i}
       RETURNING id_cliente, nombre, email, telefono, id_empleado`,
      values
    );
    if (rowCount === 0) {
      return reply.code(404).send({ error: 'Cliente no encontrado' });
    }
    return reply.send({ data: rows[0] });
  });

  fastify.delete('/api/clientes/:id', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return reply.code(400).send({ error: 'Identificador de cliente no válido' });
    }
    try {
      const { rowCount } = await pool.query(`DELETE FROM cliente WHERE id_cliente = $1`, [id]);
      if (rowCount === 0) {
        return reply.code(404).send({ error: 'Cliente no encontrado' });
      }
      return reply.code(204).send();
    } catch (err) {
      if (err.code === '23503') {
        return reply
          .code(409)
          .send({ error: 'No se puede eliminar: el cliente tiene compras u otras referencias' });
      }
      throw err;
    }
  });
}
