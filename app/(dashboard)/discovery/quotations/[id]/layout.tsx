import type { ReactNode } from "react";
export default function DocumentWorkspaceLayout({children,preview}:{children:ReactNode;preview:ReactNode}) {
  return <>{children}{preview}</>;
}
