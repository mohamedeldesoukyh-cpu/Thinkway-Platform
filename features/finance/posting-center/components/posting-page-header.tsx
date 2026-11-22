import Link from "next/link";

export function PostingPageHeader() {
  return <header className="tw-c">
    <div style={{ background: "linear-gradient(135deg,#0040cc,#0057ff 45%,#1a6fff)", color: "white", padding: "20px 22px" }}>
      <h1 style={{ color: "inherit", fontSize: 20, fontWeight: 600, margin: 0 }}>Post to Accounting</h1>
      <p style={{ color: "#d6e3ff", fontSize: 13, marginTop: 6 }}>Review Media documents and manage their Accounting journals.</p>
    </div>
    <nav className="tw-ch" aria-label="Posting workspaces">
      <span className="tw-ct">Media document posting</span>
      <span className="tw-sp" />
      <Link className="tw-b" href="/finance">Back to Finance</Link>
    </nav>
  </header>;
}
