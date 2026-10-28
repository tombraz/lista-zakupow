CREATE TABLE "list_daily_activity" (
	"list_id" uuid NOT NULL,
	"day" date NOT NULL,
	"user_id" text NOT NULL,
	"checks" integer NOT NULL,
	CONSTRAINT "list_daily_activity_list_id_day_user_id_pk" PRIMARY KEY("list_id","day","user_id")
);
--> statement-breakpoint
ALTER TABLE "list_daily_activity" ADD CONSTRAINT "list_daily_activity_list_id_shopping_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."shopping_list"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_daily_activity" ADD CONSTRAINT "list_daily_activity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "list_daily_activity_user_id_idx" ON "list_daily_activity" USING btree ("user_id");