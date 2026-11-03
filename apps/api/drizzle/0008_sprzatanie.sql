CREATE TABLE "cleanup_run" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	CONSTRAINT "cleanup_run_single_row" CHECK ("cleanup_run"."id" = 1)
);
