


-- =============================================================================
-- LOCAL DEV BASELINE — captured from the production schema (2026-11-21).
-- Recreates the current app schema on a FRESH LOCAL database so that
-- `supabase start` / `supabase db reset` can build a dev DB to test against.
--
-- DO NOT run this against production — prod already has this schema, and prod
-- changes are applied by hand in the Supabase SQL Editor (see REVIEW.md and the
-- per-user PRs), never via `supabase db push`. See DEV_SETUP.md for usage.
-- =============================================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "position_id" "uuid" NOT NULL,
    "resume_id" "uuid",
    "cover_letter_id" "uuid",
    "status" "text" DEFAULT 'applied'::"text" NOT NULL,
    "applied_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "first_interview_at" timestamp with time zone,
    "first_offer_at" timestamp with time zone,
    "first_response_at" timestamp with time zone,
    CONSTRAINT "applications_status_check" CHECK (("status" = ANY (ARRAY['applied'::"text", 'interviewing'::"text", 'offered'::"text", 'accepted'::"text", 'declined'::"text", 'rejected'::"text", 'withdrawn'::"text", 'ghosted'::"text"])))
);


ALTER TABLE "public"."applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "size" integer,
    "url" "text",
    "glassdoor_rating" numeric(2,1),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "title" "text",
    "email" "text",
    "phone" "text",
    "linkedin_url" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "is_base" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "documents_type_check" CHECK (("type" = ANY (ARRAY['resume'::"text", 'cover_letter'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_contacts" (
    "event_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL
);


ALTER TABLE "public"."event_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "application_id" "uuid",
    "type" "text" NOT NULL,
    "date" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "events_type_check" CHECK (("type" = ANY (ARRAY['interview'::"text", 'offer'::"text", 'rejection'::"text", 'follow_up'::"text", 'chat'::"text", 'other'::"text", 'entity_created'::"text", 'discovered'::"text", 'status_change'::"text"])))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."focus_videos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "url" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_favorite" boolean DEFAULT false,
    "duration" "text"
);


ALTER TABLE "public"."focus_videos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "type" "text" NOT NULL,
    "label" "text" NOT NULL,
    "target_value" integer,
    "current_value" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "is_auto" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sort_order" integer
);


ALTER TABLE "public"."goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_sites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "url" "text" NOT NULL,
    "username" "text",
    "notes" "text",
    "is_preset" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."job_sites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" DEFAULT 'Untitled'::"text" NOT NULL,
    "content" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."positions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text",
    "description" "text",
    "url_listing" "text",
    "url_application" "text",
    "pay_min" numeric(10,2),
    "pay_max" numeric(10,2),
    "pay_type" "text",
    "posted_at" timestamp with time zone,
    "benefits" "text",
    "location" "text",
    "travel_requirements" "text",
    "requirements" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "positions_pay_type_check" CHECK (("pay_type" = ANY (ARRAY['hourly'::"text", 'salary'::"text"]))),
    CONSTRAINT "positions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'closed'::"text", 'not_interested'::"text", 'applying'::"text", 'applied'::"text"]))),
    CONSTRAINT "positions_type_check" CHECK (("type" = ANY (ARRAY['full_time'::"text", 'part_time'::"text", 'contract'::"text", 'internship'::"text", 'temporary'::"text"])))
);


ALTER TABLE "public"."positions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "daily_goal" integer DEFAULT 2,
    "stale_days" integer DEFAULT 7,
    "ghost_days" integer DEFAULT 14,
    "visible_event_types" "text"[] DEFAULT ARRAY['interview'::"text", 'offer'::"text", 'rejection'::"text", 'follow_up'::"text", 'chat'::"text", 'other'::"text", 'entity_created'::"text", 'discovered'::"text", 'status_change'::"text"],
    "google_calendar_token" "text",
    "pomodoro_work_min" integer DEFAULT 25,
    "pomodoro_break_min" integer DEFAULT 5,
    "session_tracker_enabled" boolean DEFAULT true,
    "session_tracker_interval_min" integer DEFAULT 30,
    "theme_primary" "text" DEFAULT '#1976d2'::"text",
    "theme_secondary" "text" DEFAULT '#9c27b0'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "theme_background" "text",
    "theme_background_images" "text"[] DEFAULT '{}'::"text"[],
    "theme_background_image" "text"
);


ALTER TABLE "public"."settings" OWNER TO "postgres";


ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_contacts"
    ADD CONSTRAINT "event_contacts_pkey" PRIMARY KEY ("event_id", "contact_id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."focus_videos"
    ADD CONSTRAINT "focus_videos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_sites"
    ADD CONSTRAINT "job_sites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_user_id_key" UNIQUE ("user_id");



CREATE OR REPLACE TRIGGER "set_settings_updated_at" BEFORE UPDATE ON "public"."settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."applications" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."notes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."positions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_cover_letter_id_fkey" FOREIGN KEY ("cover_letter_id") REFERENCES "public"."documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "public"."documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_contacts"
    ADD CONSTRAINT "event_contacts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_contacts"
    ADD CONSTRAINT "event_contacts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



CREATE POLICY "Authenticated users can manage focus videos" ON "public"."focus_videos" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can manage job sites" ON "public"."job_sites" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users only" ON "public"."applications" TO "authenticated" USING (true);



CREATE POLICY "Authenticated users only" ON "public"."companies" TO "authenticated" USING (true);



CREATE POLICY "Authenticated users only" ON "public"."contacts" TO "authenticated" USING (true);



CREATE POLICY "Authenticated users only" ON "public"."documents" TO "authenticated" USING (true);



CREATE POLICY "Authenticated users only" ON "public"."event_contacts" TO "authenticated" USING (true);



CREATE POLICY "Authenticated users only" ON "public"."events" TO "authenticated" USING (true);



CREATE POLICY "Authenticated users only" ON "public"."positions" TO "authenticated" USING (true);



CREATE POLICY "Users can manage their own settings" ON "public"."settings" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auth_all" ON "public"."applications" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all" ON "public"."companies" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all" ON "public"."contacts" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all" ON "public"."documents" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all" ON "public"."event_contacts" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all" ON "public"."events" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all" ON "public"."focus_videos" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all" ON "public"."goals" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all" ON "public"."job_sites" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all" ON "public"."positions" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all" ON "public"."settings" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."focus_videos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."goals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goals_all" ON "public"."goals" USING (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."job_sites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notes_self" ON "public"."notes" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."positions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."settings" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."applications" TO "anon";
GRANT ALL ON TABLE "public"."applications" TO "authenticated";
GRANT ALL ON TABLE "public"."applications" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."event_contacts" TO "anon";
GRANT ALL ON TABLE "public"."event_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."event_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."focus_videos" TO "anon";
GRANT ALL ON TABLE "public"."focus_videos" TO "authenticated";
GRANT ALL ON TABLE "public"."focus_videos" TO "service_role";



GRANT ALL ON TABLE "public"."goals" TO "anon";
GRANT ALL ON TABLE "public"."goals" TO "authenticated";
GRANT ALL ON TABLE "public"."goals" TO "service_role";



GRANT ALL ON TABLE "public"."job_sites" TO "anon";
GRANT ALL ON TABLE "public"."job_sites" TO "authenticated";
GRANT ALL ON TABLE "public"."job_sites" TO "service_role";



GRANT ALL ON TABLE "public"."notes" TO "anon";
GRANT ALL ON TABLE "public"."notes" TO "authenticated";
GRANT ALL ON TABLE "public"."notes" TO "service_role";



GRANT ALL ON TABLE "public"."positions" TO "anon";
GRANT ALL ON TABLE "public"."positions" TO "authenticated";
GRANT ALL ON TABLE "public"."positions" TO "service_role";



GRANT ALL ON TABLE "public"."settings" TO "anon";
GRANT ALL ON TABLE "public"."settings" TO "authenticated";
GRANT ALL ON TABLE "public"."settings" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







