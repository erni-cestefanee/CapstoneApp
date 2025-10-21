-- Admin RLS policies (non-recursive)
-- Run this in Supabase SQL editor as a privileged user (or any role that can create policies).
-- This script assumes `public.admin_users(id uuid)` already exists and contains admin auth UIDs.
-- Adjust table/column names below if your schema uses different column names for user foreign keys.

-- == USERS ==
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users: select own" ON public.users;
CREATE POLICY "Users: select own"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users: insert own" ON public.users;
CREATE POLICY "Users: insert own"
  ON public.users FOR INSERT
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users: update own" ON public.users;
CREATE POLICY "Users: update own"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users: delete own" ON public.users;
CREATE POLICY "Users: delete own"
  ON public.users FOR DELETE
  USING (auth.uid() = id);

-- Admin policies for users
DROP POLICY IF EXISTS "Users: admin select" ON public.users;
CREATE POLICY "Users: admin select"
  ON public.users FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id = auth.uid()));

DROP POLICY IF EXISTS "Users: admin update" ON public.users;
CREATE POLICY "Users: admin update"
  ON public.users FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id = auth.uid()));

DROP POLICY IF EXISTS "Users: admin delete" ON public.users;
CREATE POLICY "Users: admin delete"
  ON public.users FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id = auth.uid()));


-- == LEAVE_BALANCES ==
-- Assumes leave_balances.user_id references users.id
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "LeaveBalances: select own" ON public.leave_balances;
CREATE POLICY "LeaveBalances: select own"
  ON public.leave_balances FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "LeaveBalances: insert own" ON public.leave_balances;
CREATE POLICY "LeaveBalances: insert own"
  ON public.leave_balances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "LeaveBalances: update own" ON public.leave_balances;
CREATE POLICY "LeaveBalances: update own"
  ON public.leave_balances FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "LeaveBalances: delete own" ON public.leave_balances;
CREATE POLICY "LeaveBalances: delete own"
  ON public.leave_balances FOR DELETE
  USING (auth.uid() = user_id);

-- Admin policies for leave_balances
DROP POLICY IF EXISTS "LeaveBalances: admin select" ON public.leave_balances;
CREATE POLICY "LeaveBalances: admin select"
  ON public.leave_balances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND ('admin' = ANY (COALESCE(u.roles, ARRAY[]::text[])))
    )
  );

DROP POLICY IF EXISTS "LeaveBalances: admin insert" ON public.leave_balances;
CREATE POLICY "LeaveBalances: admin insert"
  ON public.leave_balances FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND ('admin' = ANY (COALESCE(u.roles, ARRAY[]::text[])))
    )
  );

DROP POLICY IF EXISTS "LeaveBalances: admin update" ON public.leave_balances;
CREATE POLICY "LeaveBalances: admin update"
  ON public.leave_balances FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND ('admin' = ANY (COALESCE(u.roles, ARRAY[]::text[])))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND ('admin' = ANY (COALESCE(u.roles, ARRAY[]::text[])))
    )
  );

DROP POLICY IF EXISTS "LeaveBalances: admin delete" ON public.leave_balances;
CREATE POLICY "LeaveBalances: admin delete"
  ON public.leave_balances FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND ('admin' = ANY (COALESCE(u.roles, ARRAY[]::text[])))
    )
  );


-- == LEAVE_APPLICATIONS ==
-- Assumes leave_applications.user_id references users.id
ALTER TABLE public.leave_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "LeaveApplications: select own" ON public.leave_applications;
CREATE POLICY "LeaveApplications: select own"
  ON public.leave_applications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "LeaveApplications: insert own" ON public.leave_applications;
CREATE POLICY "LeaveApplications: insert own"
  ON public.leave_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "LeaveApplications: update own" ON public.leave_applications;
CREATE POLICY "LeaveApplications: update own"
  ON public.leave_applications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "LeaveApplications: delete own" ON public.leave_applications;
CREATE POLICY "LeaveApplications: delete own"
  ON public.leave_applications FOR DELETE
  USING (auth.uid() = user_id);

-- Admin policies for leave_applications
DROP POLICY IF EXISTS "LeaveApplications: admin select" ON public.leave_applications;
CREATE POLICY "LeaveApplications: admin select"
  ON public.leave_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND ('admin' = ANY (COALESCE(u.roles, ARRAY[]::text[])))
    )
  );

DROP POLICY IF EXISTS "LeaveApplications: admin insert" ON public.leave_applications;
CREATE POLICY "LeaveApplications: admin insert"
  ON public.leave_applications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND ('admin' = ANY (COALESCE(u.roles, ARRAY[]::text[])))
    )
  );

DROP POLICY IF EXISTS "LeaveApplications: admin update" ON public.leave_applications;
CREATE POLICY "LeaveApplications: admin update"
  ON public.leave_applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND ('admin' = ANY (COALESCE(u.roles, ARRAY[]::text[])))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND ('admin' = ANY (COALESCE(u.roles, ARRAY[]::text[])))
    )
  );

DROP POLICY IF EXISTS "LeaveApplications: admin delete" ON public.leave_applications;
CREATE POLICY "LeaveApplications: admin delete"
  ON public.leave_applications FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND ('admin' = ANY (COALESCE(u.roles, ARRAY[]::text[])))
    )
  );


-- == LEAVE_REQUESTS ==
-- If you have a table named leave_requests with a user_id FK, apply similar policies.
-- Adjust column names if different.
-- NOTE: This project uses `leave_applications` (not `leave_requests`).
-- The policies above already configure `leave_applications`. No policies
-- are created for `leave_requests` since that table does not exist in your schema.


-- == TEAMS ==
-- If you have a teams table with owner_id or similar FK use owner_id, otherwise adjust.
ALTER TABLE IF EXISTS public.teams ENABLE ROW LEVEL SECURITY;

-- Owner policy (sul_id)
DROP POLICY IF EXISTS "Teams: select own" ON public.teams;
CREATE POLICY "Teams: select own"
  ON public.teams FOR SELECT
  USING (auth.uid() = sul_id);

DROP POLICY IF EXISTS "Teams: insert own" ON public.teams;
CREATE POLICY "Teams: insert own"
  ON public.teams FOR INSERT
  WITH CHECK (auth.uid() = sul_id);

DROP POLICY IF EXISTS "Teams: update own" ON public.teams;
CREATE POLICY "Teams: update own"
  ON public.teams FOR UPDATE
  USING (auth.uid() = sul_id)
  WITH CHECK (auth.uid() = sul_id);

DROP POLICY IF EXISTS "Teams: delete own" ON public.teams;
CREATE POLICY "Teams: delete own"
  ON public.teams FOR DELETE
  USING (auth.uid() = sul_id);

-- Admin policies for teams
DROP POLICY IF EXISTS "Teams: admin select" ON public.teams;
CREATE POLICY "Teams: admin select"
  ON public.teams FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id = auth.uid()));

DROP POLICY IF EXISTS "Teams: admin insert" ON public.teams;
CREATE POLICY "Teams: admin insert"
  ON public.teams FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id = auth.uid()));

DROP POLICY IF EXISTS "Teams: admin update" ON public.teams;
CREATE POLICY "Teams: admin update"
  ON public.teams FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id = auth.uid()));

DROP POLICY IF EXISTS "Teams: admin delete" ON public.teams;
CREATE POLICY "Teams: admin delete"
  ON public.teams FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id = auth.uid()));


-- End of policies

-- Notes:
-- - If a table or column name differs in your DB, edit the script accordingly before running.
-- - Run this in the Supabase SQL editor; after running, test admin actions in the UI and check for policy-denied errors in the console/network responses.
-- - If you prefer RPCs for some actions, keep admin_delete_user RPC for deletes and use policies for routine CRUD.
