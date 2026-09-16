import { createClient, type Client, type InValue, type ResultSet } from "@libsql/client";
import { BlobNotFoundError, del, get, head, put } from "@vercel/blob";

let client: Client | undefined;
function databaseClient() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url || (process.env.VERCEL === "1" && url.startsWith("file:"))) throw new Error("DB_UNAVAILABLE");
  return client ??= createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN, intMode: "number" });
}
function result(value: ResultSet) {
  return { success: true, results: value.rows.map((row) => Object.fromEntries(value.columns.map((column) => [column, row[column]]))),
    meta: { changes: value.rowsAffected, last_row_id: Number(value.lastInsertRowid ?? 0) } };
}
class Statement {
  constructor(readonly sql: string, readonly args: InValue[] = []) {}
  bind(...args: InValue[]) { return new Statement(this.sql, args); }
  async all<T = Record<string, unknown>>() { return result(await databaseClient().execute(this)) as unknown as D1Result<T>; }
  async run() { return this.all(); }
  async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
    const row = (await this.all<Record<string, unknown>>()).results[0];
    return row ? (column ? row[column] : row) as T : null;
  }
  async raw<T = unknown[]>(options?: { columnNames?: boolean }) {
    const value = await databaseClient().execute(this);
    const rows = value.rows.map((row) => value.columns.map((column) => row[column]));
    return (options?.columnNames ? [value.columns, ...rows] : rows) as T[];
  }
}
const database = {
  prepare(sql: string) { return new Statement(sql); },
  async batch(statements: Statement[]) { return statements.length ? (await databaseClient().batch(statements, "write")).map(result) : []; },
} as unknown as D1Database;

function storageOptions() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("STORAGE_UNAVAILABLE");
  return { token, abortSignal: AbortSignal.timeout(30_000) };
}
const storage = {
  async head(key: string) {
    try { const object = await head(key, storageOptions()); return { key, size: object.size }; }
    catch (error) { if (error instanceof BlobNotFoundError) return null; throw error; }
  },
  async get(key: string) {
    const object = await get(key, { ...storageOptions(), access: "private", useCache: false });
    if (!object) return null;
    if (object.statusCode !== 200) throw new Error("STORAGE_READ_FAILED");
    return { key, body: object.stream, arrayBuffer: () => new Response(object.stream).arrayBuffer() };
  },
  async put(key: string, value: string | Uint8Array, options?: { httpMetadata?: { contentType?: string } }) {
    await put(key, typeof value === "string" ? value : Buffer.from(value), {
      ...storageOptions(), access: "private", addRandomSuffix: false, allowOverwrite: false,
      contentType: options?.httpMetadata?.contentType,
    });
    return { key };
  },
  async delete(key: string) { await del(key, storageOptions()); },
} as unknown as R2Bucket;

export const env = {
  get DB() { return process.env.TURSO_DATABASE_URL ? database : undefined; },
  get BUCKET() { return process.env.BLOB_READ_WRITE_TOKEN ? storage : undefined; },
  get DOCUMENTS_ACCESS_PASSWORD_HASH() { return process.env.DOCUMENTS_ACCESS_PASSWORD_HASH; },
  get SESSION_SECRET() { return process.env.SESSION_SECRET; },
  get PDF_SIGNING_SERVICE_URL() { return process.env.PDF_SIGNING_SERVICE_URL; },
  get PDF_SIGNING_SERVICE_TOKEN() { return process.env.PDF_SIGNING_SERVICE_TOKEN; },
};
