/**
 * Registro de venta con transacción explícita (BEGIN / COMMIT / ROLLBACK).
 */

export async function ventasRoutes(fastify, opts) {
  const { pool } = opts;

  fastify.post('/api/ventas', async (request, reply) => {
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

    const fechaCompra = typeof fecha === 'string' && fecha.length > 0 ? fecha : new Date().toISOString().slice(0, 10);
    const obs = observaciones === undefined || observaciones === '' ? null : String(observaciones).slice(0, 500);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insCompra = await client.query(
        `INSERT INTO compra (fecha, id_cliente, id_empleado, observaciones)
         VALUES ($1::date, $2, $3, $4)
         RETURNING id_compra`,
        [fechaCompra, cid, eid, obs]
      );
      const idCompra = insCompra.rows[0].id_compra;

      const insFactura = await client.query(
        `INSERT INTO factura (id_compra, fecha_emision, estado)
         VALUES ($1, $2::date, 'emitida')
         RETURNING id_factura`,
        [idCompra, fechaCompra]
      );
      const idFactura = insFactura.rows[0].id_factura;

      for (const linea of lineas) {
        const pid = Number(linea.id_producto);
        const cant = Number(linea.cantidad);
        if (!Number.isInteger(pid) || pid < 1) {
          throw Object.assign(new Error('Cada línea requiere id_producto entero válido'), { statusCode: 400 });
        }
        if (!Number.isInteger(cant) || cant < 1) {
          throw Object.assign(new Error('Cada línea requiere cantidad entera positiva'), { statusCode: 400 });
        }

        const resProd = await client.query(
          `SELECT precio_venta, stock, activo
           FROM producto
           WHERE id_producto = $1
           FOR UPDATE`,
          [pid]
        );
        if (resProd.rowCount === 0) {
          throw Object.assign(new Error(`Producto ${pid} no existe`), { statusCode: 400 });
        }
        const prod = resProd.rows[0];
        if (!prod.activo) {
          throw Object.assign(new Error(`Producto ${pid} inactivo`), { statusCode: 400 });
        }
        const stock = Number(prod.stock);
        if (stock < cant) {
          throw Object.assign(
            new Error(`Stock insuficiente para producto ${pid}: hay ${stock}, se pidieron ${cant}`),
            { statusCode: 400 }
          );
        }

        const precioUnit = Number(prod.precio_venta);

        await client.query(
          `INSERT INTO detalle (id_factura, id_producto, cantidad, precio_unitario, subtotal)
           VALUES ($1, $2, $3, $4::numeric, ($3::numeric * $4::numeric))`,
          [idFactura, pid, cant, precioUnit]
        );

        await client.query(
          `UPDATE producto SET stock = stock - $1 WHERE id_producto = $2`,
          [cant, pid]
        );
      }

      await client.query('COMMIT');

      return reply.code(201).send({
        data: {
          id_compra: idCompra,
          id_factura: idFactura,
          mensaje: 'Venta registrada correctamente',
        },
      });
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        fastify.log.warn(rollbackErr);
      }
      const code = err.statusCode ?? (err.code === '23503' ? 400 : 500);
      if (code >= 500) {
        fastify.log.error(err);
      }
      return reply.code(code).send({
        error: err.message || 'Error al registrar la venta',
        rollback: true,
      });
    } finally {
      client.release();
    }
  });
}
