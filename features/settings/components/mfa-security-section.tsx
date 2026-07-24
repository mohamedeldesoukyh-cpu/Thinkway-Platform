import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  mfaRequired: boolean;
  roleSlug: string | null;
};

export function MfaSecuritySection({ mfaRequired, roleSlug }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Authenticator (TOTP)</CardTitle>
        <CardDescription>
          {mfaRequired
            ? `Your role (${roleSlug}) requires multi-factor authentication at AAL2 for privileged actions.`
            : `Your role (${roleSlug ?? "unknown"}) does not require MFA. You can still enroll optionally.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/auth/mfa/enroll?next=/settings/security">
            Enroll or re-enroll authenticator
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/auth/mfa?next=/settings/security">
            Verify current session (AAL2)
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
