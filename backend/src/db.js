import pg from 'pg';
import { assertRole } from './roles.js';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL en el entorno (.env)');
  process.exit(1);
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

/** Ejecuta SQL con SET ROLE (sin transacción externa; los SP gestionan BEGIN/COMMIT/ROLLBACK). */
export async function withDbRole(rolDb, fn) {
  assertRole(rolDb);
  const client = await pool.connect();
  try {
    await client.query(`SET ROLE ${rolDb}`);
    const result = await fn(client);
    await client.query('RESET ROLE');
    return result;
  } catch (err) {
    try {
      await client.query('RESET ROLE');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}
