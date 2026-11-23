CREATE TYPE "public"."moderation_state" AS ENUM('visible', 'hidden', 'removed');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('about_me', 'hurtful', 'private', 'spam', 'other');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'review_needed';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'call_removed';--> statement-breakpoint
CREATE TABLE "blocks" (
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"call_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reason" "report_reason" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_call_id_user_id_pk" PRIMARY KEY("call_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "calls" DROP CONSTRAINT "calls_author_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "calls" DROP CONSTRAINT "calls_subject_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "calls" DROP CONSTRAINT "calls_settler_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "calls" DROP CONSTRAINT "calls_proposed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "calls" DROP CONSTRAINT "calls_disputed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "groups" DROP CONSTRAINT "groups_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "calls" ALTER COLUMN "author_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "moderation" "moderation_state" DEFAULT 'visible' NOT NULL;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "banned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blocks_blocked" ON "blocks" USING btree ("blocked_id");--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_subject_id_users_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_settler_id_users_id_fk" FOREIGN KEY ("settler_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_proposed_by_users_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_disputed_by_users_id_fk" FOREIGN KEY ("disputed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;