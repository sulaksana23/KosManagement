import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";

const globalForDb = globalThis as unknown as { pgPool?: Pool };

export const pool = globalForDb.pgPool ?? new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql://kosmanager:kosmanager@localhost:5432/kosmanager",
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

export const db = drizzle(pool, { schema });
