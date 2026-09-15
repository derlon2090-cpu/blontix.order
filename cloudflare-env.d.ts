declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    PDF_SIGNING_SERVICE_URL?: string;
    PDF_SIGNING_SERVICE_TOKEN?: string;
    DOCUMENTS_ACCESS_PASSWORD_HASH?: string;
    SESSION_SECRET?: string;
  }
}
