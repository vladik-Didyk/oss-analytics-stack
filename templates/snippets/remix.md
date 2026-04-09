// app/root.tsx — Remix integration

import { useEffect } from "react";
import { useLocation } from "@remix-run/react";
import CookieConsent from "./components/consent/CookieConsent";
import { hasConsented, initAnalytics, trackPageView } from "./lib/analytics";

function AnalyticsTracker() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (hasConsented()) {
      initAnalytics().then(() => trackPageView(pathname));
    }
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <html lang="en">
      <head>{/* … */}</head>
      <body>
        {/* …Outlet, Scripts, etc.… */}
        <AnalyticsTracker />
        <CookieConsent />
      </body>
    </html>
  );
}

// NOTE: Remix env vars are server-side by default. Either:
//   1. Use a loader to expose them as window.ENV (recommended for Remix patterns), OR
//   2. Switch to Vite-based Remix and use VITE_ prefix.
// The analytics.ssr.js template auto-detects both process.env and import.meta.env.
