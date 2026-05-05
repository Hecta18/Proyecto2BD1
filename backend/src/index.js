import Fastify from 'fastify';
import cors from '@fastify/cors';
import { pool } from './db.js';
import { consultasRoutes } from './routes/consultas.js';
import { productosRoutes } from './routes/productos.js';
import { clientesRoutes } from './routes/clientes.js';
import { ventasRoutes } from './routes/ventas.js';

const app = Fastify({ logger: true });

app.setErrorHandler((error, _request, reply) => {
  if (error.validation) {
    return reply.code(400).send({ error: 'Cuerpo de la petición no válido', detalle: error.message });
  }
  const status = error.statusCode ?? 500;
  if (status >= 500) {
    app.log.error(error);
  }
  return reply.code(status).send({
    error: status === 500 ? 'Error interno del servidor' : error.message,
  });
});

await app.register(cors, { origin: true });

app.get('/health', async () => ({ ok: true }));

app.register(consultasRoutes, { pool });
app.register(productosRoutes, { pool });
app.register(clientesRoutes, { pool });
app.register(ventasRoutes, { pool });

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
