CREATE TABLE "borrower_accounts" (
	"id" text PRIMARY KEY,
	"borrower_id" text NOT NULL,
	"email" text NOT NULL,
	"normalized_email" text NOT NULL,
	"password_hash" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "borrower_sessions" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "borrower_accounts_borrower_id_unique" ON "borrower_accounts" ("borrower_id");--> statement-breakpoint
CREATE UNIQUE INDEX "borrower_accounts_normalized_email_unique" ON "borrower_accounts" ("normalized_email");--> statement-breakpoint
CREATE UNIQUE INDEX "borrower_sessions_token_hash_unique" ON "borrower_sessions" ("token_hash");--> statement-breakpoint
CREATE INDEX "borrower_sessions_account_id_index" ON "borrower_sessions" ("account_id");--> statement-breakpoint
CREATE INDEX "borrower_sessions_expires_at_index" ON "borrower_sessions" ("expires_at");--> statement-breakpoint
ALTER TABLE "borrower_accounts" ADD CONSTRAINT "borrower_accounts_borrower_id_borrowers_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "borrowers"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "borrower_sessions" ADD CONSTRAINT "borrower_sessions_account_id_borrower_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "borrower_accounts"("id") ON DELETE CASCADE;