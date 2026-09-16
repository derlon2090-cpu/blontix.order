CREATE TABLE "access_devices" (
	"device_token_hash" text PRIMARY KEY NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"banned_at" text,
	"created_at" text NOT NULL,
	"last_seen_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_login_attempts" (
	"subject_hash" text PRIMARY KEY NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"locked_until" text,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_login_challenges" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"device_hash" text NOT NULL,
	"created_at" text NOT NULL,
	"expires_at" text NOT NULL,
	"consumed_at" text
);
--> statement-breakpoint
CREATE TABLE "access_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"device_hash" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL,
	"expires_at" text NOT NULL,
	"revoked_at" text
);
--> statement-breakpoint
CREATE TABLE "document_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"kind" text NOT NULL,
	"object_key" text NOT NULL,
	"sha256" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"sequence" integer NOT NULL,
	"document_id" text NOT NULL,
	"event_type" text NOT NULL,
	"result" text NOT NULL,
	"actor_id" text,
	"previous_hash" text NOT NULL,
	"event_hash" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_verification_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'revoked' NOT NULL,
	"revoked_at" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"masked_phone" text NOT NULL,
	"product_name" text NOT NULL,
	"price" text NOT NULL,
	"order_approved_at" text NOT NULL,
	"delivered_at" text NOT NULL,
	"delivery_method" text NOT NULL,
	"status" text DEFAULT 'final' NOT NULL,
	"document_reference" text NOT NULL,
	"document_version" integer DEFAULT 1 NOT NULL,
	"terms_version" text DEFAULT '1' NOT NULL,
	"snapshot_json" text NOT NULL,
	"snapshot_hash" text NOT NULL,
	"image_key" text NOT NULL,
	"image_content_type" text NOT NULL,
	"pdf_key" text NOT NULL,
	"created_at" text NOT NULL,
	"generated_at" text NOT NULL,
	"finalized_at" text DEFAULT '' NOT NULL,
	"verification_token" text NOT NULL,
	"verification_token_hash" text NOT NULL,
	"verification_id" text DEFAULT '' NOT NULL,
	"pdf_sha256" text DEFAULT '' NOT NULL,
	"template_version" text DEFAULT 'AP-DOC-V1' NOT NULL,
	"branding_version" text DEFAULT 'AP-BRAND-V1' NOT NULL,
	"logo_asset_id" text DEFAULT 'advanced-pro-wordmark-v1' NOT NULL,
	"logo_asset_sha256" text DEFAULT '' NOT NULL,
	"logo_asset_key" text DEFAULT '' NOT NULL,
	"renderer_version" text DEFAULT 'AP-PDF-ENGINE-1.0' NOT NULL,
	"render_input_key" text DEFAULT '' NOT NULL,
	"render_input_sha256" text DEFAULT '' NOT NULL,
	"lifecycle_status" text DEFAULT 'final' NOT NULL,
	"supersedes_document_id" text,
	"reissue_reason" text,
	"audit_head_hash" text DEFAULT '' NOT NULL,
	"audit_event_count" integer DEFAULT 0 NOT NULL,
	"idempotency_key" text DEFAULT '' NOT NULL,
	"signed_at" text,
	"certificate_fingerprint" text,
	"certificate_serial" text,
	"signature_status" text DEFAULT 'not_configured' NOT NULL,
	"timestamp_status" text DEFAULT 'not_configured' NOT NULL,
	"timestamp_authority_result" text
);
--> statement-breakpoint
CREATE TABLE "verification_events" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text,
	"result" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_rate_limits" (
	"subject_hash" text NOT NULL,
	"window_start" integer NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "verification_rate_limits_subject_hash_window_start_pk" PRIMARY KEY("subject_hash","window_start")
);
--> statement-breakpoint
ALTER TABLE "document_assets" ADD CONSTRAINT "document_assets_document_id_order_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "order_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_access_devices_banned_at" ON "access_devices" USING btree ("banned_at");--> statement-breakpoint
CREATE INDEX "idx_access_login_challenges_expires_at" ON "access_login_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_access_sessions_expires_at" ON "access_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_document_assets_key" ON "document_assets" USING btree ("object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_document_assets_kind" ON "document_assets" USING btree ("document_id","kind");--> statement-breakpoint
CREATE INDEX "idx_document_audit_document_created" ON "document_audit_logs" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_document_audit_sequence" ON "document_audit_logs" USING btree ("document_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_document_verification_tokens_token" ON "document_verification_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_document_verification_tokens_document" ON "document_verification_tokens" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_order_documents_reference" ON "order_documents" USING btree ("document_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_order_documents_order_version" ON "order_documents" USING btree ("order_number","document_version");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_order_documents_verification_token_hash" ON "order_documents" USING btree ("verification_token_hash");--> statement-breakpoint
CREATE INDEX "idx_order_documents_created_at" ON "order_documents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_order_documents_order_number" ON "order_documents" USING btree ("order_number");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_order_documents_verification_id" ON "order_documents" USING btree ("verification_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_order_documents_idempotency_key" ON "order_documents" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_order_documents_status_created" ON "order_documents" USING btree ("lifecycle_status","created_at");--> statement-breakpoint
CREATE INDEX "idx_verification_events_document_created" ON "verification_events" USING btree ("document_id","created_at");