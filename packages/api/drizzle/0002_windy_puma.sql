ALTER TABLE "saved_item_system_labels" DROP CONSTRAINT "saved_item_system_labels_system_label_id_system_labels_id_fk";
--> statement-breakpoint
ALTER TABLE "saved_item_tags" DROP CONSTRAINT "saved_item_tags_tag_id_tags_id_fk";
--> statement-breakpoint
ALTER TABLE "saved_items" DROP CONSTRAINT "saved_items_folder_id_folders_id_fk";
--> statement-breakpoint
ALTER TABLE "saved_item_system_labels" ADD COLUMN "library_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_item_tags" ADD COLUMN "library_id" uuid NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "folders_id_library_unique_idx" ON "folders" USING btree ("id","library_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_items_id_library_unique_idx" ON "saved_items" USING btree ("id","library_id");--> statement-breakpoint
CREATE UNIQUE INDEX "system_labels_id_library_unique_idx" ON "system_labels" USING btree ("id","library_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_id_library_unique_idx" ON "tags" USING btree ("id","library_id");--> statement-breakpoint
ALTER TABLE "saved_item_system_labels" ADD CONSTRAINT "saved_item_system_labels_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_item_system_labels" ADD CONSTRAINT "saved_item_system_labels_saved_item_library_fk" FOREIGN KEY ("saved_item_id","library_id") REFERENCES "public"."saved_items"("id","library_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_item_system_labels" ADD CONSTRAINT "saved_item_system_labels_system_label_library_fk" FOREIGN KEY ("system_label_id","library_id") REFERENCES "public"."system_labels"("id","library_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_item_tags" ADD CONSTRAINT "saved_item_tags_library_id_libraries_id_fk" FOREIGN KEY ("library_id") REFERENCES "public"."libraries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_item_tags" ADD CONSTRAINT "saved_item_tags_saved_item_library_fk" FOREIGN KEY ("saved_item_id","library_id") REFERENCES "public"."saved_items"("id","library_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_item_tags" ADD CONSTRAINT "saved_item_tags_tag_library_fk" FOREIGN KEY ("tag_id","library_id") REFERENCES "public"."tags"("id","library_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_folder_library_fk" FOREIGN KEY ("folder_id","library_id") REFERENCES "public"."folders"("id","library_id") ON DELETE no action ON UPDATE no action;
