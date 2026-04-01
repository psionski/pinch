"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    SwaggerUIBundle?: (config: Record<string, unknown>) => void;
  }
}

export default function ApiDocsPage(): React.JSX.Element {
  useEffect(() => {
    function tryInit(): void {
      if (window.SwaggerUIBundle) {
        document.documentElement.classList.add("dark-mode");
        window.SwaggerUIBundle({
          url: "/api/openapi",
          dom_id: "#swagger-ui",
          deepLinking: true,
        });
      }
    }

    // If script already loaded (e.g. from cache), init immediately
    if (window.SwaggerUIBundle) {
      tryInit();
      return;
    }

    // Load CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css";
    document.head.appendChild(link);

    // Load JS
    const script = document.createElement("script");
    script.src = "https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js";
    script.onload = tryInit;
    document.head.appendChild(script);

    return () => {
      document.documentElement.classList.remove("dark-mode");
      document.head.removeChild(link);
      document.head.removeChild(script);
    };
  }, []);

  return (
    <div style={{ minHeight: "100vh" }}>
      <style>{`html.dark-mode .swagger-ui { background: inherit; }`}</style>
      <div id="swagger-ui" />
    </div>
  );
}
