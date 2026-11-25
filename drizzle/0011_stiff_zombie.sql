CREATE TABLE "subscriptions" (
	"original_transaction_id" text PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"product_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"environment" text NOT NULL,
	"purchased_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"grace_until" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"auto_renew" boolean DEFAULT true NOT NULL,
	"in_trial" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "free_members" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscriptions_user" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
-- Groups made before subscriptions keep the size they have now for free.
UPDATE "groups" SET "free_members" = GREATEST(4, (SELECT count(*) FROM "members" m WHERE m."group_id" = "groups"."id" AND m."left_at" IS NULL));
