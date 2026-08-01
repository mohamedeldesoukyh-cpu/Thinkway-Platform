import Link from "next/link";
import { redirect } from "next/navigation";

import { MfaEnrollForm } from "@/features/auth/components/mfa-enroll-form";
import { roleRequiresMfa } from "@/lib/auth/mfa-policy";
import { sanitizeNextPath } from "@/lib/auth/routes";
import { getRequestAuth } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function MfaEnrollPage({ searchParams }: Props) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next);
  const { user, roleSlug } = await getRequestAuth();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  if (!roleRequiresMfa(roleSlug)) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-muted-foreground">
          Your role does not require multi-factor authentication.
        </p>
        <Link href={nextPath} className="text-sm underline">
          Continue
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="w-full max-w-md space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Set up authenticator
        </h1>
        <p className="text-sm text-muted-foreground">
          Admin, Super Admin, and Finance accounts must enable TOTP before using
          privileged actions.
        </p>
      </div>
      <MfaEnrollForm nextPath={nextPath} />
      <Link href="/login" className="text-sm text-muted-foreground underline">
        Back to sign in
      </Link>
    </main>
  );
}
