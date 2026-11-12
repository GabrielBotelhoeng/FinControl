import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../generated/prisma/client';

export type Db = PrismaClient;

/** O cliente normal ou o de uma transação interativa. Repositórios que não abrem transações próprias aceitam os dois. */
export type DbClient = Prisma.TransactionClient;

export function createPrisma(databaseUrl: string): Db {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}
