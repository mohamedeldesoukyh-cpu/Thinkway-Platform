import Link from "next/link";

import { MfaChallengeForm } from "@/features/auth/components/mfa-challenge-form";
import { sanitizeNextPath } from "@/lib/auth/routes";
import { requireRequestUser } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function MfaChallengePage({ searchParams }: Props) {
  await requireRequestUser();
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="w-full max-w-md space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Two-factor authentication
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter the code from your authenticator app to continue.
        </p>
      </div>
      <MfaChallengeForm nextPath={nextPath} />
      <Link href="/login" className="text-sm text-muted-foreground underline">
        Back to sign in
      </Link>
    </main>
  );
}
