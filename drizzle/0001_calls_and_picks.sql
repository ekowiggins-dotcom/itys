CREATE TYPE "public"."call_kind" AS ENUM('yes_no', 'choice', 'member');--> statement-breakpoint
CREATE TYPE "public"."call_status" AS ENUM('active', 'cancelled', 'settled', 'void');--> statement-breakpoint
CREATE TABLE "calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"subject_id" uuid,
	"text" text NOT NULL,
	"kind" "call_kind" NOT NULL,
	"options" jsonb NOT NULL,
	"lock_at" timestamp with time zone NOT NULL,
	"event_at" timestamp with time zone NOT NULL,
	"status" "call_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "picks" (
	"call_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"option_key" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "picks_call_id_user_id_pk" PRIMARY KEY("call_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_subject_id_users_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "picks" ADD CONSTRAINT "picks_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "picks" ADD CONSTRAINT "picks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calls_group_lock" ON "calls" USING btree ("group_id","lock_at");--> statement-breakpoint
CREATE INDEX "calls_author" ON "calls" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "picks_user" ON "picks" USING btree ("user_id");