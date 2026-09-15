declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    PDF_SIGNING_SERVICE_URL?: string;
    PDF_SIGNING_SERVICE_TOKEN?: string;
    PHONE_VERIFICATION_SERVICE_URL?: string;
    PHONE_VERIFICATION_SERVICE_TOKEN?: string;
  }
}
