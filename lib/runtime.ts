import 'server-only';
import type { PoolClient, QueryResult } from 'pg';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getPool, getStorage } from './providers.mjs';
import { validateEnvironment } from './environment.mjs';
type Parameter = string | number | null;
export type DatabaseResult<T = Record<string, unknown>> = { success: true; results: T[]; meta: { changes: number } };
function placeholders(sql: string) {
  let index = 0;
  return sql.replace(/'(?:''|[^'])*'|\?/g, value => value === '?' ? `$${++index}` : value);
}
function result<T>(value: QueryResult): DatabaseResult<T> { return { success: true, results: value.rows, meta: { changes: value.rowCount ?? 0 } }; }
export class Statement {
  constructor(readonly sql: string, readonly args: Parameter[] = [], readonly connection?: PoolClient) {}
  bind(...args: Parameter[]) { return new Statement(this.sql, args, this.connection); }
  async all<T = Record<string, unknown>>() {
    try { return result<T>(await (this.connection ?? getPool()).query(placeholders(this.sql), this.args)); }
    catch { throw new Error('Database operation failed'); }
  }
  async run() { return this.all(); }
  async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
    const row = (await this.all<Record<string, unknown>>()).results[0];
    return row ? (column ? row[column] : row) as T : null;
  }
}
export class Database {
  constructor(readonly connection?: PoolClient) {}
  prepare(sql: string) { return new Statement(sql, [], this.connection); }
  async batch(statements: Statement[]) {
    const execute = async (db: Database) => {
      const results = [];
      for (const statement of statements) results.push(await db.prepare(statement.sql).bind(...statement.args).all());
      return results;
    };
    return this.connection ? execute(this) : this.transaction(execute);
  }
  async transaction<T>(operation: (db: Database) => Promise<T>): Promise<T> {
    if (this.connection) return operation(this);
    const connection = await getPool().connect();
    try {
      await connection.query('BEGIN');
      const value = await operation(new Database(connection));
      await connection.query('COMMIT'); return value;
    } catch (error) { await connection.query('ROLLBACK').catch(() => undefined); throw error; }
    finally { connection.release(); }
  }
}
const database = new Database();
const missing = (error: unknown) => ['NotFound', 'NoSuchKey'].includes((error as { name?: string }).name ?? '');
const bucket = () => validateEnvironment().R2_BUCKET_NAME;
const storage = {
  async head(key: string) {
    try { const value = await getStorage().send(new HeadObjectCommand({ Bucket: bucket(), Key: key })); return { key, size: value.ContentLength ?? 0 }; }
    catch (error) { if (missing(error)) return null; throw new Error('Storage read failed'); }
  },
  async get(key: string) {
    try {
      const value = await getStorage().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
      if (!value.Body) throw new Error('Storage read failed');
      const bytes = await value.Body.transformToByteArray();
      return { key, body: bytes, arrayBuffer: async () => Uint8Array.from(bytes).buffer };
    } catch (error) { if (missing(error)) return null; throw new Error('Storage read failed'); }
  },
  async put(key: string, value: string | Uint8Array, options?: { httpMetadata?: { contentType?: string; contentDisposition?: string }; customMetadata?: Record<string, string> }) {
    try {
      await getStorage().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: value, IfNoneMatch: '*', ContentType: options?.httpMetadata?.contentType, ContentDisposition: options?.httpMetadata?.contentDisposition, Metadata: options?.customMetadata }));
      return { key };
    } catch { throw new Error('Storage write failed'); }
  },
  async delete(key: string) {
    try { await getStorage().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key })); }
    catch { throw new Error('Storage cleanup failed'); }
  },
};
export const env = {
  get DB() { validateEnvironment(); return database; },
  get BUCKET() { validateEnvironment(); return storage; },
  get DOCUMENTS_ACCESS_PASSWORD_HASH() { return validateEnvironment().DOCUMENTS_ACCESS_PASSWORD_HASH; },
  get SESSION_SECRET() { return validateEnvironment().SESSION_SECRET; },
  get PDF_SIGNING_SERVICE_URL() { return process.env.PDF_SIGNING_SERVICE_URL; },
  get PDF_SIGNING_SERVICE_TOKEN() { return process.env.PDF_SIGNING_SERVICE_TOKEN; },
};
