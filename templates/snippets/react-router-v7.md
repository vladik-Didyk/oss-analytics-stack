// app/root.tsx — extend CSP, mount AnalyticsTracker + CookieConsent

import { useEffect } from "react";
import { useLocation } from "react-router";
import CookieConsent from "./components/consent/CookieConsent";
import { hasConsented, initAnalytics, trackPageView } from "./lib/analytics";

// 1. CRITICAL: extend your Content-Security-Policy meta tag in <head>:
//
//   "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com
//     https://www.google-analytics.com https://www.clarity.ms https://*.clarity.ms
//     https://*.posthog.com https://us-assets.i.posthog.com",
//
//   "connect-src 'self' https://www.google-analytics.com https://*.analytics.google.com
//     https://*.google-analytics.com https://*.clarity.ms https://*.posthog.com
//     https://us.i.posthog.com",
//
//   "img-src 'self' data: https://www.google-analytics.com https://*.google-analytics.com
//     https://*.clarity.ms"
//
// Without these, the scripts will be blocked silently.

function AnalyticsTracker() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (hasConsented()) {
      initAnalytics().then(() => trackPageView(pathname));
    }
  }, [pathname]);
  return null;
}

export default function Root() {
  return (
    <>
      {/* …your existing root… */}
      <AnalyticsTracker />
      <CookieConsent />
    </>
  );
}
