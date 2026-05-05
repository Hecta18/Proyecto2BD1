export async function productosRoutes(fastify, opts) {
  const { pool } = opts;

  fastify.get('/api/productos', async (_request, reply) => {
    const { rows } = await pool.query(
      `SELECT id_producto, nombre, precio_venta, stock, activo
       FROM producto
       ORDER BY id_producto`
    );
    return reply.send({ data: rows });
  });

  fastify.get('/api/productos/:id', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return reply.code(400).send({ error: 'Identificador de producto no válido' });
    }
    const { rows } = await pool.query(
      `SELECT id_producto, nombre, precio_venta, stock, activo
       FROM producto WHERE id_producto = $1`,
      [id]
    );
    if (rows.length === 0) {
      return reply.code(404).send({ error: 'Producto no encontrado' });
    }
    return reply.send({ data: rows[0] });
  });

  fastify.post('/api/productos', async (request, reply) => {
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
    const { rows } = await pool.query(
      `INSERT INTO producto (nombre, precio_venta, stock, activo)
       VALUES ($1, $2, $3, $4)
       RETURNING id_producto, nombre, precio_venta, stock, activo`,
      [nombre.trim(), precio, stk, act]
    );
    return reply.code(201).send({ data: rows[0] });
  });

  fastify.put('/api/productos/:id', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return reply.code(400).send({ error: 'Identificador de producto no válido' });
    }
    const { nombre, precio_venta, stock, activo } = request.body ?? {};
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
    if (precio_venta !== undefined) {
      const precio = Number(precio_venta);
      if (!Number.isFinite(precio) || precio < 0) {
        return reply.code(400).send({ error: 'precio_venta inválido' });
      }
      fields.push(`precio_venta = $${i++}`);
      values.push(precio);
    }
    if (stock !== undefined) {
      const stk = Number(stock);
      if (!Number.isInteger(stk) || stk < 0) {
        return reply.code(400).send({ error: 'stock inválido' });
      }
      fields.push(`stock = $${i++}`);
      values.push(stk);
    }
    if (activo !== undefined) {
      fields.push(`activo = $${i++}`);
      values.push(Boolean(activo));
    }
    if (fields.length === 0) {
      return reply.code(400).send({ error: 'No hay campos para actualizar' });
    }
    values.push(id);
    const { rows, rowCount } = await pool.query(
      `UPDATE producto SET ${fields.join(', ')}
       WHERE id_producto = $${i}
       RETURNING id_producto, nombre, precio_venta, stock, activo`,
      values
    );
    if (rowCount === 0) {
      return reply.code(404).send({ error: 'Producto no encontrado' });
    }
    return reply.send({ data: rows[0] });
  });

  fastify.delete('/api/productos/:id', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return reply.code(400).send({ error: 'Identificador de producto no válido' });
    }
    const { rows, rowCount } = await pool.query(
      `UPDATE producto SET activo = FALSE
       WHERE id_producto = $1
       RETURNING id_producto, nombre, precio_venta, stock, activo`,
      [id]
    );
    if (rowCount === 0) {
      return reply.code(404).send({ error: 'Producto no encontrado' });
    }
    return reply.send({ data: rows[0], mensaje: 'Producto desactivado (baja lógica)' });
  });
}
