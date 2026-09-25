"use client";

/** A root failure must still offer recovery, independent of app providers/styles. */
export default function GlobalError() {
  return <html lang="en"><body style={{ margin: 0, background: "#f8fafc", color: "#172033", fontFamily: "Arial, sans-serif" }}>
    <main style={{ maxWidth: 480, margin: "15vh auto", padding: 24 }}>
      <h1 style={{ fontSize: 24 }}>Thinkway could not finish loading</h1>
      <p style={{ lineHeight: 1.6 }}>The application encountered a loading error. Reload this page to try again.</p>
      <button type="button" onClick={() => window.location.reload()} style={{ padding: "12px 18px", border: 0, borderRadius: 8, background: "#0057ff", color: "#fff", fontSize: 16, cursor: "pointer" }}>Reload application</button>
      <p><a href="/" style={{ color: "#0057ff" }}>Open Home</a></p>
    </main>
  </body></html>;
}
