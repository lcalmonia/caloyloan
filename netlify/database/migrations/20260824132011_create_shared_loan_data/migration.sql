CREATE TABLE "borrowers" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"owner" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" text PRIMARY KEY,
	"no" text NOT NULL UNIQUE,
	"borrower_id" text NOT NULL,
	"borrower_name" text NOT NULL,
	"principal" double precision NOT NULL,
	"rate" double precision NOT NULL,
	"term" integer NOT NULL,
	"method" text NOT NULL,
	"frequency" text DEFAULT 'monthly' NOT NULL,
	"rate_basis" text DEFAULT 'annual' NOT NULL,
	"penalty_rate" double precision DEFAULT 0 NOT NULL,
	"penalty_rule" text DEFAULT 'overdue_balance_weekly' NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'ongoing' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY,
	"loan_id" text NOT NULL,
	"borrower_id" text NOT NULL,
	"borrower_name" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"amount" double precision NOT NULL,
	"method" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY,
	"default_rate" double precision DEFAULT 12 NOT NULL,
	"default_term" integer DEFAULT 12 NOT NULL,
	"default_method" text DEFAULT 'reducing' NOT NULL,
	"default_frequency" text DEFAULT 'monthly' NOT NULL,
	"default_penalty_rate" double precision DEFAULT 0 NOT NULL,
	"loan_calc_version" integer DEFAULT 2 NOT NULL,
	"loan_counter" integer DEFAULT 1000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_borrower_id_borrowers_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "borrowers"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_loan_id_loans_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_borrower_id_borrowers_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "borrowers"("id") ON DELETE RESTRICT;