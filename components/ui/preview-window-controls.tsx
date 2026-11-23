import { Maximize2, Minimize2, X } from "lucide-react";
import { closeDocumentPreview } from "@/lib/navigation/preview-navigation";

export function PreviewWindowControls({ maximized, onToggle, onClose, closeHref }: {
  maximized: boolean; onToggle: () => void; onClose?: () => void; closeHref?: string;
}) {
  const style = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 32, flexShrink: 0, border: "1px solid #bdced7", borderRadius: 5, background: "#fff", color: "#17384a", cursor: "pointer" } as const;
  const closeStyle = { ...style, color: "#c62828" };
  return <div role="group" aria-label="Preview window controls" style={{ display: "flex", gap: 6, flexShrink: 0 }}>
    <button type="button" style={style} onClick={onToggle} title={maximized ? "Restore preview" : "Maximise preview"} aria-label={maximized ? "Restore preview" : "Maximise preview"}>
      {maximized ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
    </button>
    {closeHref ? <button type="button" onClick={() => closeDocumentPreview(closeHref)} style={closeStyle} title="Close preview" aria-label="Close preview"><X size={18} style={{ color: "#c62828" }}/></button>
      : <button type="button" style={closeStyle} onClick={onClose} title="Close preview" aria-label="Close preview"><X size={18}/></button>}
  </div>;
}
