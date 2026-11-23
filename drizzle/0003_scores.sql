CREATE TABLE "scores" (
	"call_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"settled_at" timestamp with time zone NOT NULL,
	"points" integer NOT NULL,
	"correct" boolean NOT NULL,
	CONSTRAINT "scores_call_id_user_id_pk" PRIMARY KEY("call_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scores_group_time" ON "scores" USING btree ("group_id","settled_at");--> statement-breakpoint
-- Backfill scores for calls settled before scoring existed (same rule as src/server/scoring.ts).
INSERT INTO "scores" ("call_id", "user_id", "group_id", "settled_at", "points", "correct")
SELECT p."call_id", p."user_id", c."group_id", c."settled_at",
  CASE WHEN p."option_key" = c."result"
    THEN round(10 + 30 * (1 - (count(*) FILTER (WHERE p."option_key" = c."result") OVER w)::numeric / (count(*) OVER w)))::int
    ELSE 0 END,
  p."option_key" = c."result"
FROM "picks" p JOIN "calls" c ON c."id" = p."call_id"
WHERE c."status" = 'settled' AND c."settled_at" IS NOT NULL
  AND (SELECT count(*) FROM "picks" p2 WHERE p2."call_id" = c."id") >= 2
WINDOW w AS (PARTITION BY p."call_id")
ON CONFLICT DO NOTHING;
