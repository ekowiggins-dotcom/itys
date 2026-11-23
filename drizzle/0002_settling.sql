ALTER TYPE "public"."call_status" ADD VALUE 'proposed';--> statement-breakpoint
ALTER TYPE "public"."call_status" ADD VALUE 'disputed';--> statement-breakpoint
CREATE TABLE "votes" (
	"call_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"option_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_call_id_user_id_pk" PRIMARY KEY("call_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "settler_id" uuid;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "proposed_result" text;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "proposed_by" uuid;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "proposed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "disputed_by" uuid;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "vote_closes_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "result" text;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "void_reason" text;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "settled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "next_action_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_settler_id_users_id_fk" FOREIGN KEY ("settler_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_proposed_by_users_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_disputed_by_users_id_fk" FOREIGN KEY ("disputed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calls_next_action" ON "calls" USING btree ("next_action_at") WHERE "calls"."next_action_at" IS NOT NULL;--> statement-breakpoint
UPDATE "calls" SET "next_action_at" = "lock_at" WHERE "status" = 'active';
