CREATE TYPE "public"."integration_provider" AS ENUM('github');--> statement-breakpoint
CREATE TYPE "public"."provider_surface" AS ENUM('github_stars');--> statement-breakpoint
CREATE TYPE "public"."integration_account_status" AS ENUM('connected', 'disabled', 'needs_reconnect', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."external_item_presence_status" AS ENUM('present', 'missing');--> statement-breakpoint
CREATE TYPE "public"."external_item_metadata_status" AS ENUM('complete', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."import_rule_condition_field" AS ENUM('language', 'topics', 'name', 'stargazers_count', 'forks_count', 'private', 'archived');--> statement-breakpoint
CREATE TYPE "public"."import_rule_condition_operator" AS ENUM('is', 'contains', '>', '>=', '<', '<=', '==');--> statement-breakpoint
CREATE TYPE "public"."import_rule_action_type" AS ENUM('add_tag', 'move_to_folder');--> statement-breakpoint
CREATE TYPE "public"."sync_run_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "integration_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"library_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"provider_surface" "provider_surface" NOT NULL,
	"connected_by_user_id" uuid NOT NULL,
	"external_account_id" text NOT NULL,
	"external_account_name" text NOT NULL,
	"status" "integration_account_status" DEFAULT 'connected' NOT NULL,
	"access_token" text,
	"last_sync_started_at" timestamp with time zone,
	"last_sync_finished_at" timestamp with time zone,
	"last_sync_status" "sync_run_status",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"library_id" uuid NOT NULL,
	"saved_item_id" uuid NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"provider_surface" "provider_surface" NOT NULL,
	"external_id" text NOT NULL,
	"external_url" text NOT NULL,
	"presence_status" "external_item_presence_status" DEFAULT 'present' NOT NULL,
	"provider_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata_status" "external_item_metadata_status" DEFAULT 'complete' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"missing_since" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"library_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"condition_field" "import_rule_condition_field" NOT NULL,
	"condition_operator" "import_rule_condition_operator" NOT NULL,
	"condition_value" jsonb NOT NULL,
	"action_type" "import_rule_action_type" NOT NULL,
	"action_target_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_import_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"library_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"default_folder_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"library_id" uuid NOT NULL,
	"saved_item_id" uuid NOT NULL,
	"external_item_id" uuid NOT NULL,
	"import_rule_id" uuid NOT NULL,
	"action_type" "import_rule_action_type" NOT NULL,
	"action_target_id" text NOT NULL,
	"matched_field" text NOT NULL,
	"matched_value" jsonb NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_account_id" uuid NOT NULL,
	"status" "sync_run_status" DEFAULT 'queued' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_count" integer DEFAULT 0 NOT NULL,
	"attached_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"checkpoint" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_accounts" ADD CONSTRAINT "integration_accounts_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_accounts" ADD CONSTRAINT "integration_accounts_connected_by_user_id_users_id_fk" FOREIGN KEY ("connected_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_items" ADD CONSTRAINT "external_items_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_items" ADD CONSTRAINT "external_items_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_items" ADD CONSTRAINT "external_items_saved_item_library_fk" FOREIGN KEY ("saved_item_id","library_id") REFERENCES "public"."saved_items"("id","library_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rules" ADD CONSTRAINT "import_rules_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_import_settings" ADD CONSTRAINT "provider_import_settings_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_import_settings" ADD CONSTRAINT "provider_import_settings_default_folder_library_fk" FOREIGN KEY ("default_folder_id","library_id") REFERENCES "public"."folders"("id","library_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_applications" ADD CONSTRAINT "rule_applications_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_applications" ADD CONSTRAINT "rule_applications_external_item_id_external_items_id_fk" FOREIGN KEY ("external_item_id") REFERENCES "public"."external_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_applications" ADD CONSTRAINT "rule_applications_import_rule_id_import_rules_id_fk" FOREIGN KEY ("import_rule_id") REFERENCES "public"."import_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_applications" ADD CONSTRAINT "rule_applications_saved_item_library_fk" FOREIGN KEY ("saved_item_id","library_id") REFERENCES "public"."saved_items"("id","library_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_integration_account_id_integration_accounts_id_fk" FOREIGN KEY ("integration_account_id") REFERENCES "public"."integration_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integration_accounts_library_provider_status_idx" ON "integration_accounts" USING btree ("library_id","provider","status");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_accounts_active_unique_idx" ON "integration_accounts" USING btree ("library_id","provider","provider_surface","external_account_id") WHERE "integration_accounts"."status" != 'disconnected';--> statement-breakpoint
CREATE INDEX "external_items_saved_item_idx" ON "external_items" USING btree ("saved_item_id");--> statement-breakpoint
CREATE INDEX "external_items_library_provider_surface_idx" ON "external_items" USING btree ("library_id","provider","provider_surface");--> statement-breakpoint
CREATE UNIQUE INDEX "external_items_provider_external_unique_idx" ON "external_items" USING btree ("integration_account_id","provider_surface","external_id");--> statement-breakpoint
CREATE INDEX "import_rules_library_provider_sort_idx" ON "import_rules" USING btree ("library_id","provider","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_import_settings_library_provider_unique_idx" ON "provider_import_settings" USING btree ("library_id","provider");--> statement-breakpoint
CREATE INDEX "rule_applications_saved_item_idx" ON "rule_applications" USING btree ("saved_item_id");--> statement-breakpoint
CREATE INDEX "sync_runs_integration_account_idx" ON "sync_runs" USING btree ("integration_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_runs_active_unique_idx" ON "sync_runs" USING btree ("integration_account_id") WHERE "sync_runs"."status" in ('queued', 'running');
