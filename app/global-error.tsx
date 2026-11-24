"use client";

/**
 * Last line of defence: only shown if the root layout itself fails, so it carries its own
 * <html> and plain styles, both languages (the language cookie may be what failed), and no
 * server calls. The digest matches the server log; the raw error never reaches the browser.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 480 }}>
        <h1 style={{ fontSize: 22 }}>Something went wrong · कुछ गड़बड़ हुई</h1>
        <p>Nothing was saved. Try again. · कुछ सेव नहीं हुआ। फिर से कोशिश करें।</p>
        {error.digest ? <p style={{ fontFamily: "monospace" }}>{error.digest}</p> : null}
        <button onClick={reset} style={{ minHeight: 48, padding: "0 20px", fontSize: 17 }}>
          Try again · फिर से कोशिश करें
        </button>
      </body>
    </html>
  );
}
