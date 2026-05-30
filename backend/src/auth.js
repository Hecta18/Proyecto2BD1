import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import { pool } from './db.js';
import { canAccess } from './roles.js';

const SESSION_SECRET = process.env.SESSION_SECRET || 'proyecto3-dev-secret-change-me';

export const authPlugin = fp(async (fastify) => {
  await fastify.register(cookie);
  await fastify.register(session, {
    secret: SESSION_SECRET,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 8,
      sameSite: 'lax',
    },
    saveUninitialized: false,
  });

  fastify.decorate('requireAuth', async (request, reply) => {
    if (!request.session.user) {
      return reply.code(401).send({ error: 'Debe iniciar sesión' });
    }
  });

  fastify.decorate('requirePermission', (permission) => async (request, reply) => {
    if (!request.session.user) {
      return reply.code(401).send({ error: 'Debe iniciar sesión' });
    }
    const { rol_db: rol } = request.session.user;
    if (!canAccess(rol, permission)) {
      return reply.code(403).send({ error: 'No tiene permiso para esta operación' });
    }
  });

  fastify.post('/api/auth/login', async (request, reply) => {
    const { username, password } = request.body ?? {};
    if (!username || !password) {
      return reply.code(400).send({ error: 'Usuario y contraseña son obligatorios' });
    }
    const { rows } = await pool.query(
      `SELECT id_usuario, username, nombre, rol_db, activo
       FROM usuario_app
       WHERE username = $1
         AND password_hash = crypt($2, password_hash)
         AND activo = TRUE`,
      [String(username).trim(), String(password)]
    );
    if (rows.length === 0) {
      return reply.code(401).send({ error: 'Credenciales incorrectas' });
    }
    const user = rows[0];
    request.session.user = {
      id_usuario: user.id_usuario,
      username: user.username,
      nombre: user.nombre,
      rol_db: user.rol_db,
    };
    return reply.send({
      data: {
        username: user.username,
        nombre: user.nombre,
        rol_db: user.rol_db,
        permisos: buildPermisosUi(user.rol_db),
      },
    });
  });

  fastify.post('/api/auth/logout', async (request, reply) => {
    await request.session.destroy();
    return reply.send({ ok: true });
  });

  fastify.get('/api/auth/me', { preHandler: fastify.requireAuth }, async (request) => {
    const user = request.session.user;
    return {
      data: {
        username: user.username,
        nombre: user.nombre,
        rol_db: user.rol_db,
        permisos: buildPermisosUi(user.rol_db),
      },
    };
  });
});

function buildPermisosUi(rol) {
  return {
    reporte: canAccess(rol, 'reporte'),
    productos: canAccess(rol, 'productos_read'),
    productosWrite: canAccess(rol, 'productos_write'),
    clientes: canAccess(rol, 'clientes_read'),
    clientesWrite: canAccess(rol, 'clientes_write'),
    venta: canAccess(rol, 'venta'),
    consultas: canAccess(rol, 'consultas'),
    totalesPeriodo: canAccess(rol, 'totales_periodo'),
    anularFactura: canAccess(rol, 'anular_factura'),
    ajustarStock: canAccess(rol, 'ajustar_stock'),
  };
}
