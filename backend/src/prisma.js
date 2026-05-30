import { PrismaClient } from '@prisma/client';
import { assertRole } from './roles.js';

export const prisma = new PrismaClient();
/**
 * Ejecuta operaciones ORM bajo SET ROLE en la misma conexión (transacción Prisma).
 */
export async function withPrismaRole(rolDb, fn) {
  assertRole(rolDb);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL ROLE ${rolDb}`);
    const result = await fn(tx);
    await tx.$executeRawUnsafe('RESET ROLE');
    return result;
  });
}
