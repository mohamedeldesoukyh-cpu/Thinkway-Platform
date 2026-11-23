import PreviewPage from "../../preview/page";
import type { ComponentProps } from "react";
export default function WorkspacePreview(props:ComponentProps<typeof PreviewPage>) {
 return <div role="dialog" aria-modal="true" aria-label="Document preview" style={{position:"fixed",inset:0,zIndex:100,background:"#08063f",overflow:"auto"}}><PreviewPage {...props}/></div>;
}
