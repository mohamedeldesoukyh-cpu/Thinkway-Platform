export function SharePreviewCard({ campaignName, clientLabel, logo }: {
  campaignName: string; clientLabel?: string | null; logo?: string | null;
}) {
  const title = campaignName.length > 150 ? `${campaignName.slice(0, 147)}…` : campaignName;
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", padding: 58, flexDirection: "column",
      background: "linear-gradient(120deg, #08257e 0%, #0849ed 65%, #4784ff 100%)", color: "white", position: "relative", overflow: "hidden" }}>
      <div style={{ display: "flex", position: "absolute", width: 560, height: 560, border: "80px solid rgba(255,255,255,0.08)", borderRadius: 560, right: -180, top: -220 }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 700, letterSpacing: -1 }}>
          <div style={{ display: "flex", width: 48, height: 48, borderRadius: 13, background: "#080d22", position: "relative" }}>
            <div style={{ display: "flex", width: 14, height: 14, borderRadius: 14, background: "white", position: "absolute", left: 9, top: 8 }} />
            <div style={{ display: "flex", width: 19, height: 19, borderRadius: 19, background: "#246cff", position: "absolute", right: 7, bottom: 7 }} />
          </div>THINKWAY
        </div>
        {logo ? <div style={{ display: "flex", background: "white", padding: "14px 24px", borderRadius: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" width={180} height={48} style={{ objectFit: "contain" }} />
        </div> : <div style={{ display: "flex", fontSize: 22, color: "#dbe7ff", maxWidth: 430 }}>{clientLabel?.slice(0, 55) || "CLIENT WORKSPACE"}</div>}
      </div>
      <div style={{ display: "flex", marginTop: 62, fontSize: 17, letterSpacing: 4, color: "#bcd6ff" }}>YOUR NEXT CAMPAIGN</div>
      <div style={{ display: "flex", marginTop: 20, fontSize: title.length > 85 ? 48 : 62, fontWeight: 700, lineHeight: 1.13, maxWidth: 1050 }}>{title}</div>
      <div style={{ display: "flex", marginTop: "auto", paddingTop: 25, borderTop: "1px solid rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", fontSize: 22, color: "#dbe7ff" }}>Creators · Quotation · Campaign</div>
        <div style={{ display: "flex", background: "white", color: "#0748ec", padding: "15px 25px", borderRadius: 12, fontSize: 20, fontWeight: 700 }}>Explore your campaign →</div>
      </div>
    </div>
  );
}
