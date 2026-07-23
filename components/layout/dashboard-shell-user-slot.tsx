import { Suspense } from "react";

import { UserAccount } from "@/components/layout/user-account";
import { getAuthUser } from "@/lib/supabase/server";

type DashboardShellUserSlotProps = {
  compact?: boolean;
  inSidebar?: boolean;
};

async function DashboardShellUserAccount({
  compact = false,
  inSidebar = false,
}: DashboardShellUserSlotProps) {
  const { user, fullName } = await getAuthUser();

  return (
    <UserAccount
      email={user?.email ?? null}
      name={fullName}
      compact={compact}
      inSidebar={inSidebar}
    />
  );
}

function DashboardShellUserFallback({
  compact = false,
  inSidebar = false,
}: DashboardShellUserSlotProps) {
  return (
    <UserAccount email={null} name={null} compact={compact} inSidebar={inSidebar} />
  );
}

export function DashboardShellUserSlot(props: DashboardShellUserSlotProps) {
  return (
    <Suspense fallback={<DashboardShellUserFallback {...props} />}>
      <DashboardShellUserAccount {...props} />
    </Suspense>
  );
}
