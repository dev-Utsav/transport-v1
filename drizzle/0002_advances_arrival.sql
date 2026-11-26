CREATE TABLE "staff_advances" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_id" integer NOT NULL,
	"given_on" date NOT NULL,
	"amount" integer NOT NULL,
	"mode" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"is_cancelled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_advances_amount_check" CHECK ("staff_advances"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "arrived_on" date;--> statement-breakpoint
ALTER TABLE "staff_advances" ADD CONSTRAINT "staff_advances_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_advances_staff_idx" ON "staff_advances" USING btree ("staff_id","given_on");--> statement-breakpoint
CREATE INDEX "staff_advances_given_idx" ON "staff_advances" USING btree ("given_on");--> statement-breakpoint
-- Same lock as 0001: closed to Supabase's Data API; the app connects as owner.
ALTER TABLE "staff_advances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Advances typed by hand on salary entries become khata rows (1st of that month), so the running
-- balance (given − already taken off) starts at zero for everyone.
INSERT INTO "staff_advances" ("staff_id", "given_on", "amount", "mode", "note")
SELECT "staff_id", ("month" || '-01')::date, "advance", 'cash', 'From the salary entry'
FROM "salary_months" WHERE "advance" > 0;--> statement-breakpoint
-- Arrival day for trips that already arrived, from the change history (IST).
UPDATE "trips" t SET "arrived_on" = a.day
FROM (
  SELECT "entity_id", min(("created_at" AT TIME ZONE 'Asia/Kolkata')::date) AS day
  FROM "audit_log"
  WHERE "entity" = 'trip' AND "after"->>'status' = 'arrived'
  GROUP BY "entity_id"
) a
WHERE a."entity_id" = t."id" AND t."status" IN ('arrived', 'closed') AND t."arrived_on" IS NULL;--> statement-breakpoint
-- New permissions: the office role records advances (existing roles are never re-seeded on start).
INSERT INTO "permissions" ("key") VALUES ('advances.record'), ('advances.cancel') ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_key")
SELECT "id", 'advances.record' FROM "roles" WHERE "key" = 'office'
ON CONFLICT DO NOTHING;
