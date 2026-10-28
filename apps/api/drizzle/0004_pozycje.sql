CREATE TABLE "item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"list_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"note" text,
	"added_by" text,
	"checked_at" timestamp with time zone,
	"checked_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_list_id_name_key_unique" UNIQUE("list_id","name_key"),
	CONSTRAINT "item_name_length" CHECK (char_length("item"."name") BETWEEN 1 AND 100),
	CONSTRAINT "item_note_length" CHECK (char_length("item"."note") <= 200)
);
--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_list_id_shopping_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."shopping_list"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_checked_by_user_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;