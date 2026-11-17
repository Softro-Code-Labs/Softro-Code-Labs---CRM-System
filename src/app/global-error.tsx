"use client";

/** Last-resort error screen, used if the root layout itself fails. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#0c0a09", color: "#e7e5e4", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 18 }}>Softro CRM hit a problem</h1>
          <p style={{ fontSize: 14, color: "#a8a29e" }}>The admins have been told. Please try again in a moment.</p>
          {error.digest && <p style={{ fontSize: 12, color: "#78716c", fontFamily: "monospace" }}>Ref: {error.digest}</p>}
          <button onClick={reset} style={{ marginTop: 16, padding: "8px 16px", borderRadius: 8, border: 0, background: "#b91c1c", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
