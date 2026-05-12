import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Inicialización lazy para que el build no falle sin DATABASE_URL
function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no configurada. Copia .env.local.example a .env.local y añade tu connection string de Neon.');
  }
  const sql = neon(process.env.DATABASE_URL);
  return drizzle(sql, { schema });
}

let _db: ReturnType<typeof getDb> | null = null;

export function getDatabase() {
  if (!_db) {
    _db = getDb();
  }
  return _db;
}

// Alias para compatibilidad con código que importa `db` directamente
export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_target, prop) {
    return getDatabase()[prop as keyof ReturnType<typeof getDb>];
  },
});
