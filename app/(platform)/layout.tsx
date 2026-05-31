import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { getCurrentProfile, getCurrentUser } from '@/lib/auth/session'
import { ROUTES } from '@/lib/constants/routes'
import { PLATFORM } from '@/config/platform'

export const metadata: Metadata = {
  title: {
    default: PLATFORM.name,
    template: `%s — ${PLATFORM.name}`,
  },
  description: `${PLATFORM.name} ${PLATFORM.tagline}`,
}

function buildSeedSql(email: string): string {
  return `-- Step 1: Create required enum types (safe if they already exist)
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM (
    'admin', 'director', 'manager', 'account_manager', 'finance', 'data_entry'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.user_status AS ENUM (
    'active', 'inactive', 'suspended', 'pending'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Step 2: Add missing columns to the profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name  TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS role       public.user_role   DEFAULT 'data_entry',
  ADD COLUMN IF NOT EXISTS status     public.user_status DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS team       TEXT,
  ADD COLUMN IF NOT EXISTS reports_to_id UUID;

-- Step 3: Insert your admin profile
INSERT INTO public.profiles (id, email, full_name, role, status)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  'admin',
  'active'
FROM auth.users
WHERE email = '${email}'
ON CONFLICT (id) DO UPDATE
  SET role      = 'admin',
      status    = 'active',
      full_name = EXCLUDED.full_name;`
}

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getCurrentProfile()

  if (!profile) {
    // Distinguish between "not logged in" and "logged in but no profile row".
    // If we redirect to /login when the user IS authenticated, the middleware
    // sends them back to /dashboard → infinite redirect loop → white screen.
    const user = await getCurrentUser()

    if (!user) {
      redirect(ROUTES.AUTH.LOGIN)
    }

    // Authenticated but no profile row — schema was likely applied after account creation.
    // Show a one-time setup screen with the SQL to fix it.
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="w-full max-w-lg text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-brand/10 mx-auto mb-4">
            <span className="text-xl font-bold text-brand">TW</span>
          </div>
          <h1 className="text-lg font-semibold text-foreground mb-2">Profile setup required</h1>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
            Your session is valid but no user profile was found. This happens when the
            database schema was applied after your account was created.
          </p>
          <p className="text-sm font-medium text-foreground mb-2 text-left">
            Run this SQL in the Supabase SQL Editor, then refresh:
          </p>
          <pre className="text-left text-xs bg-muted rounded-xl p-4 text-foreground overflow-x-auto mb-4 border border-border">
            {buildSeedSql(user.email ?? '')}
          </pre>
          <p className="text-xs text-muted-foreground">
            Authenticated as: <span className="font-mono">{user.email}</span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar — desktop only */}
      <div className="hidden md:flex">
        <Sidebar role={profile.role} />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          fullName={profile.fullName}
          email={profile.email}
          role={profile.role}
          avatarUrl={profile.avatarUrl}
        />

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
