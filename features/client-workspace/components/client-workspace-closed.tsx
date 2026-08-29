export function ClientWorkspaceClosed({
  title = "This workspace is not enabled",
  body = "Your Thinkway team has not enabled Client Workspace for this organisation. Campaign work continues internally. Speak with your account team if you need access.",
}: {
  title?: string;
  body?: string;
} = {}) {
  return (
    <div className="tw-review">
      <div className="entry-wrap">
        <div className="card entry-card" style={{ textAlign: "center" }}>
          <p className="ck">Thinkway Client Workspace</p>
          <h2>{title}</h2>
          <p className="note">{body}</p>
        </div>
      </div>
    </div>
  );
}
