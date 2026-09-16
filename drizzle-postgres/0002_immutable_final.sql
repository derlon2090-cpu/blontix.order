CREATE FUNCTION protect_final_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Final documents cannot be deleted';
  END IF;
  IF OLD.status = 'final' AND
    (to_jsonb(NEW) - ARRAY['lifecycle_status','verification_token','verification_token_hash','audit_head_hash','audit_event_count'])
      IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['lifecycle_status','verification_token','verification_token_hash','audit_head_hash','audit_event_count']) THEN
    RAISE EXCEPTION 'Final document content is immutable; create a new version';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER enforce_final_document_immutability BEFORE UPDATE OR DELETE ON order_documents
FOR EACH ROW EXECUTE FUNCTION protect_final_document();
--> statement-breakpoint
ALTER TABLE order_documents ADD CONSTRAINT valid_final_status CHECK (status = 'final');
--> statement-breakpoint
ALTER TABLE order_documents ADD CONSTRAINT valid_document_version CHECK (document_version >= 1);
--> statement-breakpoint
ALTER TABLE order_documents ADD CONSTRAINT valid_lifecycle_status CHECK (lifecycle_status IN ('final','superseded','cancelled'));
--> statement-breakpoint
ALTER TABLE document_assets ADD CONSTRAINT nonnegative_asset_size CHECK (file_size >= 0);
--> statement-breakpoint
ALTER TABLE document_audit_logs ADD CONSTRAINT positive_audit_sequence CHECK (sequence >= 1);
