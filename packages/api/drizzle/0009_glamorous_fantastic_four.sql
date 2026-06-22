ALTER TABLE "tags" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "tags"
SET "sort_order" = ranked."sort_order"
FROM (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "library_id"
      ORDER BY lower("name"), "id"
    ) - 1 AS "sort_order"
  FROM "tags"
) AS ranked
WHERE "tags"."id" = ranked."id";--> statement-breakpoint
CREATE INDEX "tags_library_sort_idx" ON "tags" USING btree ("library_id","sort_order");
