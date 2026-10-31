CREATE TABLE "list_member" (
	"list_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "list_member_list_id_user_id_pk" PRIMARY KEY("list_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "shopping_list" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shopping_list_name_length" CHECK (char_length("shopping_list"."name") BETWEEN 1 AND 100)
);
--> statement-breakpoint
ALTER TABLE "list_member" ADD CONSTRAINT "list_member_list_id_shopping_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."shopping_list"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_member" ADD CONSTRAINT "list_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list" ADD CONSTRAINT "shopping_list_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "list_member_user_id_idx" ON "list_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shopping_list_owner_id_idx" ON "shopping_list" USING btree ("owner_id");