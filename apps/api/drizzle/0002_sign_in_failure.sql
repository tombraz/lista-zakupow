CREATE TABLE "sign_in_failure" (
	"account_key" text PRIMARY KEY NOT NULL,
	"failures" integer NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL
);
