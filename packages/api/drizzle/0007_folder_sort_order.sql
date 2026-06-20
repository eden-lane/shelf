ALTER TABLE "folders" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "folders"
SET "sort_order" = ranked."sort_order"
FROM (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "library_id", "parent_id"
      ORDER BY lower("name"), "id"
    ) - 1 AS "sort_order"
  FROM "folders"
) AS ranked
WHERE "folders"."id" = ranked."id";--> statement-breakpoint
CREATE INDEX "folders_library_parent_sort_idx" ON "folders" USING btree ("library_id","parent_id","sort_order");
