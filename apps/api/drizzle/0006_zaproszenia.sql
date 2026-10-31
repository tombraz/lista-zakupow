CREATE TABLE "invitation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"list_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_by" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "invitation_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_list_id_shopping_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."shopping_list"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_used_by_user_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invitation_list_id_idx" ON "invitation" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "invitation_used_by_idx" ON "invitation" USING btree ("used_by");