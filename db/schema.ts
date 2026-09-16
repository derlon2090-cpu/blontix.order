import { index, integer, primaryKey, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

export const orderDocuments = pgTable(
  "order_documents",
  {
    id: text("id").primaryKey(),
    orderNumber: text("order_number").notNull(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    maskedPhone: text("masked_phone").notNull(),
    productName: text("product_name").notNull(),
    price: text("price").notNull(),
    orderApprovedAt: text("order_approved_at").notNull(),
    deliveredAt: text("delivered_at").notNull(),
    deliveryMethod: text("delivery_method").notNull(),
    status: text("status").notNull().default("final"),
    documentReference: text("document_reference").notNull(),
    documentVersion: integer("document_version").notNull().default(1),
    termsVersion: text("terms_version").notNull().default("1"),
    snapshotJson: text("snapshot_json").notNull(),
    snapshotHash: text("snapshot_hash").notNull(),
    imageKey: text("image_key").notNull(),
    imageContentType: text("image_content_type").notNull(),
    pdfKey: text("pdf_key").notNull(),
    createdAt: text("created_at").notNull(),
    generatedAt: text("generated_at").notNull(),
    finalizedAt: text("finalized_at").notNull().default(""),
    verificationToken: text("verification_token").notNull(),
    verificationTokenHash: text("verification_token_hash").notNull(),
    verificationId: text("verification_id").notNull().default(""),
    pdfSha256: text("pdf_sha256").notNull().default(""),
    templateVersion: text("template_version").notNull().default("AP-DOC-V1"),
    brandingVersion: text("branding_version").notNull().default("AP-BRAND-V1"),
    logoAssetId: text("logo_asset_id").notNull().default("advanced-pro-wordmark-v1"),
    logoAssetSha256: text("logo_asset_sha256").notNull().default(""),
    logoAssetKey: text("logo_asset_key").notNull().default(""),
    rendererVersion: text("renderer_version").notNull().default("AP-PDF-ENGINE-1.0"),
    renderInputKey: text("render_input_key").notNull().default(""),
    renderInputSha256: text("render_input_sha256").notNull().default(""),
    lifecycleStatus: text("lifecycle_status").notNull().default("final"),
    supersedesDocumentId: text("supersedes_document_id"),
    reissueReason: text("reissue_reason"),
    auditHeadHash: text('audit_head_hash').notNull().default(''),
    auditEventCount: integer('audit_event_count').notNull().default(0),
    idempotencyKey: text("idempotency_key").notNull().default(""),
    signedAt: text("signed_at"),
    certificateFingerprint: text("certificate_fingerprint"),
    certificateSerial: text("certificate_serial"),
    signatureStatus: text("signature_status").notNull().default("not_configured"),
    timestampStatus: text("timestamp_status").notNull().default("not_configured"),
    timestampAuthorityResult: text("timestamp_authority_result"),
  },
  (table) => [
    uniqueIndex("idx_order_documents_reference").on(table.documentReference),
    uniqueIndex("idx_order_documents_order_version").on(table.orderNumber, table.documentVersion),
    uniqueIndex("idx_order_documents_verification_token_hash").on(table.verificationTokenHash),
    index("idx_order_documents_created_at").on(table.createdAt),
    index("idx_order_documents_order_number").on(table.orderNumber),
    uniqueIndex("idx_order_documents_verification_id").on(table.verificationId),
    uniqueIndex("idx_order_documents_idempotency_key").on(table.idempotencyKey),
    index("idx_order_documents_status_created").on(table.lifecycleStatus, table.createdAt),
  ],
);

export const documentVerificationTokens = pgTable(
  "document_verification_tokens",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    status: text("status").notNull().default("revoked"),
    revokedAt: text("revoked_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_document_verification_tokens_token").on(table.tokenHash),
    index("idx_document_verification_tokens_document").on(table.documentId, table.createdAt),
  ],
);

export const documentAuditLogs = pgTable(
  "document_audit_logs",
  {
    id: text("id").primaryKey(),
    sequence: integer("sequence").notNull(),
    documentId: text("document_id").notNull(),
    eventType: text("event_type").notNull(),
    result: text("result").notNull(),
    actorId: text("actor_id"),
    previousHash: text("previous_hash").notNull(),
    eventHash: text("event_hash").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_document_audit_document_created").on(table.documentId, table.createdAt), uniqueIndex("idx_document_audit_sequence").on(table.documentId, table.sequence)],
);

export const verificationRateLimits = pgTable(
  "verification_rate_limits",
  {
    subjectHash: text("subject_hash").notNull(),
    windowStart: integer("window_start").notNull(),
    count: integer("count").notNull().default(1),
  },
  (table) => [primaryKey({ columns: [table.subjectHash, table.windowStart] })],
);

export const verificationEvents = pgTable(
  "verification_events",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id"),
    result: text("result").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_verification_events_document_created").on(table.documentId, table.createdAt)],
);

export const accessSessions = pgTable(
  "access_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    deviceHash: text("device_hash").notNull().default(""),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (table) => [index("idx_access_sessions_expires_at").on(table.expiresAt)],
);

export const accessLoginAttempts = pgTable(
  "access_login_attempts",
  {
    subjectHash: text("subject_hash").primaryKey(),
    failedCount: integer("failed_count").notNull().default(0),
    lockedUntil: text("locked_until"),
    updatedAt: text("updated_at").notNull(),
  },
);

export const accessDevices = pgTable(
  "access_devices",
  {
    deviceTokenHash: text("device_token_hash").primaryKey(),
    failedCount: integer("failed_count").notNull().default(0),
    bannedAt: text("banned_at"),
    createdAt: text("created_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
  },
  (table) => [index("idx_access_devices_banned_at").on(table.bannedAt)],
);

export const accessLoginChallenges = pgTable(
  "access_login_challenges",
  {
    tokenHash: text("token_hash").primaryKey(),
    deviceHash: text("device_hash").notNull(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
  },
  (table) => [index("idx_access_login_challenges_expires_at").on(table.expiresAt)],
);

export const documentAssets = pgTable('document_assets', {
  id: text('id').primaryKey(), documentId: text('document_id').notNull().references(() => orderDocuments.id),
  kind: text('kind').notNull(), objectKey: text('object_key').notNull(), sha256: text('sha256').notNull(),
  fileSize: integer('file_size').notNull(), mimeType: text('mime_type').notNull(), createdAt: text('created_at').notNull(),
}, table => [uniqueIndex('idx_document_assets_key').on(table.objectKey),uniqueIndex('idx_document_assets_kind').on(table.documentId,table.kind)]);

export const documentGenerationJobs = pgTable('document_generation_jobs',{
 id:text('id').primaryKey(),objectKeys:jsonb('object_keys').$type<string[]>().notNull(),status:text('status').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},table=>[index('idx_generation_jobs_status_created').on(table.status,table.createdAt)]);
