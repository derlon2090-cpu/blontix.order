import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const orderDocuments = sqliteTable(
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
    verificationToken: text("verification_token").notNull().default(""),
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
    uniqueIndex("idx_order_documents_verification_token").on(table.verificationToken),
    uniqueIndex("idx_order_documents_verification_id").on(table.verificationId),
    uniqueIndex("idx_order_documents_idempotency_key").on(table.idempotencyKey),
    index("idx_order_documents_status_created").on(table.lifecycleStatus, table.createdAt),
  ],
);

export const documentVerificationTokens = sqliteTable(
  "document_verification_tokens",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id").notNull(),
    token: text("token").notNull(),
    status: text("status").notNull().default("revoked"),
    revokedAt: text("revoked_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_document_verification_tokens_token").on(table.token),
    index("idx_document_verification_tokens_document").on(table.documentId, table.createdAt),
  ],
);

export const documentAuditLogs = sqliteTable(
  "document_audit_logs",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id").notNull(),
    eventType: text("event_type").notNull(),
    result: text("result").notNull(),
    actorId: text("actor_id"),
    previousHash: text("previous_hash").notNull(),
    eventHash: text("event_hash").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_document_audit_document_created").on(table.documentId, table.createdAt)],
);

export const verificationRateLimits = sqliteTable(
  "verification_rate_limits",
  {
    subjectHash: text("subject_hash").notNull(),
    windowStart: integer("window_start").notNull(),
    count: integer("count").notNull().default(1),
  },
  (table) => [primaryKey({ columns: [table.subjectHash, table.windowStart] })],
);

export const verificationEvents = sqliteTable(
  "verification_events",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id"),
    result: text("result").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_verification_events_document_created").on(table.documentId, table.createdAt)],
);

export const accessSessions = sqliteTable(
  "access_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    passwordHashFingerprint: text("password_hash_fingerprint").notNull(),
    deviceHash: text("device_hash").notNull().default(""),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (table) => [index("idx_access_sessions_expires_at").on(table.expiresAt)],
);

export const accessLoginAttempts = sqliteTable(
  "access_login_attempts",
  {
    subjectHash: text("subject_hash").primaryKey(),
    failedCount: integer("failed_count").notNull().default(0),
    lockedUntil: text("locked_until"),
    updatedAt: text("updated_at").notNull(),
  },
);

export const accessDevices = sqliteTable(
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

export const accessLoginChallenges = sqliteTable(
  "access_login_challenges",
  {
    tokenHash: text("token_hash").primaryKey(),
    deviceHash: text("device_hash").notNull(),
    passwordHashFingerprint: text("password_hash_fingerprint").notNull(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
  },
  (table) => [index("idx_access_login_challenges_expires_at").on(table.expiresAt)],
);
