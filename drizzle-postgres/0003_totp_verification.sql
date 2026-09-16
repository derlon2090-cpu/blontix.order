ALTER TABLE access_sessions ADD COLUMN totp_verified_at text;
--> statement-breakpoint
ALTER TABLE access_login_challenges ADD COLUMN email_verified_at text;
--> statement-breakpoint
CREATE TABLE access_totp_state (
  key_id text PRIMARY KEY,
  last_step text NOT NULL DEFAULT '-1'
);
