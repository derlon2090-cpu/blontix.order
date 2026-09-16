CREATE TABLE "document_generation_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"object_keys" jsonb NOT NULL,
	"status" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_generation_jobs_status_created" ON "document_generation_jobs" USING btree ("status","created_at");