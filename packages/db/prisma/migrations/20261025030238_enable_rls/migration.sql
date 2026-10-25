-- Supabase exposes the public schema through its Data API. Row level security with no policies
-- blocks that API completely; Prisma connects as the table owner, which bypasses RLS.
-- New tables need the same: add `ALTER TABLE "X" ENABLE ROW LEVEL SECURITY;` to their migration.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
