import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

pg.types.setTypeParser(1082, value => value); // Calendar dates never depend on the server timezone.

export async function database({ url = process.env.DATABASE_URL || process.env.POSTGRES_URL, dataDir = '.data/postgres' } = {}) {
  if (!url) {
    if (process.env.VERCEL) throw new Error('DATABASE_URL wajib diatur untuk deployment.');
    const { PGlite } = await import('@electric-sql/pglite');
    if (dataDir) await mkdir(path.dirname(path.resolve(dataDir)), { recursive: true });
    const local = new PGlite(dataDir || undefined);
    const adapt = client => ({
      query: async (sql, params = []) => {
        const result = await client.query(sql, params);
        const rows = result.rows.map(row => Object.fromEntries(Object.entries(row).map(([key,value]) => [key, ['work_date','first_date','last_date'].includes(key) && value instanceof Date ? value.toISOString().slice(0,10) : value])));
        return { ...result, rows, rowCount: result.affectedRows ?? rows.length };
      },
    });
    return { ...adapt(local), exec: sql => local.exec(sql), transaction: fn => local.transaction(tx => fn(adapt(tx))), close: () => local.close() };
  }
  const connection = new URL(url);
  let ssl;
  if (connection.hostname.endsWith('.supabase.co') || connection.hostname.endsWith('.supabase.com')) {
    const ca = process.env.SUPABASE_CA_CERT || await readFile(new URL('../config/supabase-root.crt', import.meta.url), 'utf8');
    for (const option of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) connection.searchParams.delete(option);
    ssl = { ca, rejectUnauthorized: true, minVersion: 'TLSv1.2' };
  }
  const pool = new pg.Pool({ connectionString: connection.toString(), ssl, max: 1, idleTimeoutMillis: 10000, connectionTimeoutMillis: 15000 });
  pool.on('error', () => console.error('Koneksi database terputus; koneksi baru akan digunakan.'));
  return {
    query: (sql, params = []) => pool.query(sql, params),
    exec: sql => pool.query(sql),
    async transaction(fn) {
      const client = await pool.connect();
      try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
      catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    close: () => pool.end(),
  };
}

export async function initialize(db) {
  await db.exec(await readFile(fileURLToPath(new URL('../../database/schema.sql', import.meta.url)), 'utf8'));
  await db.exec(await readFile(new URL('../../database/equipment-catalog.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../database/user-profile.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../database/speed.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../database/occ.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../database/reporting.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../database/occ-team.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../database/cctv.sql',import.meta.url),'utf8'));
}

export async function one(db, sql, values = []) { return (await db.query(sql, values)).rows[0]; }
export async function audit(db, actor, action, type, id = '', details = {}) {
  await db.query('INSERT INTO fleetsync.audit_logs(user_id,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5)', [actor, action, type, String(id), JSON.stringify(details)]);
}
