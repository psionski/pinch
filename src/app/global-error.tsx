"use client";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground flex min-h-screen items-center justify-center antialiased">
        <div className="mx-auto max-w-md space-y-4 text-center">
          <h2 className="text-2xl font-bold">Something went wrong</h2>
          {process.env.NODE_ENV === "development" && (
            <p className="text-muted-foreground text-sm">{error.message}</p>
          )}
          <button
            onClick={reset}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
