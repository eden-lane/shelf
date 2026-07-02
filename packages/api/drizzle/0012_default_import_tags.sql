ALTER TABLE "provider_import_settings" ADD COLUMN "default_tag_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;
