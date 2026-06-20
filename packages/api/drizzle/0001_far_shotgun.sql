CREATE TYPE "public"."library_kind" AS ENUM('personal', 'organization');--> statement-breakpoint
CREATE TABLE "folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"library_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "libraries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "library_kind" NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "libraries_exactly_one_owner_check" CHECK ((
        "libraries"."kind" = 'personal'
        and "libraries"."user_id" is not null
        and "libraries"."organization_id" is null
      ) or (
        "libraries"."kind" = 'organization'
        and "libraries"."user_id" is null
        and "libraries"."organization_id" is not null
      ))
);
--> statement-breakpoint
CREATE TABLE "saved_item_system_labels" (
	"saved_item_id" uuid NOT NULL,
	"system_label_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_item_system_labels_pkey" PRIMARY KEY("saved_item_id","system_label_id")
);
--> statement-breakpoint
CREATE TABLE "saved_item_tags" (
	"saved_item_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_item_tags_pkey" PRIMARY KEY("saved_item_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "saved_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"library_id" uuid NOT NULL,
	"folder_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"url" text NOT NULL,
	"title" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"library_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"library_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "libraries" ADD CONSTRAINT "libraries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "libraries" ADD CONSTRAINT "libraries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_item_system_labels" ADD CONSTRAINT "saved_item_system_labels_saved_item_id_saved_items_id_fk" FOREIGN KEY ("saved_item_id") REFERENCES "public"."saved_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_item_system_labels" ADD CONSTRAINT "saved_item_system_labels_system_label_id_system_labels_id_fk" FOREIGN KEY ("system_label_id") REFERENCES "public"."system_labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_item_tags" ADD CONSTRAINT "saved_item_tags_saved_item_id_saved_items_id_fk" FOREIGN KEY ("saved_item_id") REFERENCES "public"."saved_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_item_tags" ADD CONSTRAINT "saved_item_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_labels" ADD CONSTRAINT "system_labels_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "folders_library_idx" ON "folders" USING btree ("library_id");--> statement-breakpoint
CREATE UNIQUE INDEX "folders_library_parent_name_unique_idx" ON "folders" USING btree ("library_id",coalesce("parent_id"::text, ''),lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "libraries_personal_user_unique_idx" ON "libraries" USING btree ("user_id") WHERE "libraries"."kind" = 'personal';--> statement-breakpoint
CREATE UNIQUE INDEX "libraries_organization_unique_idx" ON "libraries" USING btree ("organization_id") WHERE "libraries"."kind" = 'organization';--> statement-breakpoint
CREATE INDEX "saved_items_library_idx" ON "saved_items" USING btree ("library_id");--> statement-breakpoint
CREATE INDEX "saved_items_folder_idx" ON "saved_items" USING btree ("folder_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_items_library_url_unique_idx" ON "saved_items" USING btree ("library_id","url");--> statement-breakpoint
CREATE INDEX "system_labels_library_idx" ON "system_labels" USING btree ("library_id");--> statement-breakpoint
CREATE UNIQUE INDEX "system_labels_library_key_unique_idx" ON "system_labels" USING btree ("library_id","key");--> statement-breakpoint
CREATE INDEX "tags_library_idx" ON "tags" USING btree ("library_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_library_name_unique_idx" ON "tags" USING btree ("library_id",lower("name"));